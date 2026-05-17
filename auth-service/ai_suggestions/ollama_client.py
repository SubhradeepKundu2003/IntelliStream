import json
import re

import httpx

from config import settings

SYSTEM_PROMPT = """You are a training stream classification expert for IntelliStream, a corporate IT training management platform.

Your role: analyze batch training subjects and business requirements, then suggest the most appropriate training streams for IT trainees.

STREAM CLASSIFICATION RULES (strictly apply these):
- Java / J2EE / Core Java / Java EE / Java developer → MUST be named "Springboot Developer"
- Python developer (general) → "Python Developer"
- Python + AI/ML context → "Python AI/ML Engineer"
- Cloud / AWS / Azure / DevOps → "Cloud DevOps Engineer" (or specify cloud provider if clear)
- Frontend / React / Angular / Web UI → "Full Stack Web Developer" or "Frontend Developer"
- SQL / data heavy → "Data Engineer"
- Security / cybersecurity → "Cybersecurity Analyst"
- AI / Machine Learning → "AI/ML Engineer"
- Agile / project management heavy → "Agile Delivery Lead"

STRICT OUTPUT RULES:
1. Output MUST be valid JSON only — no markdown, no code fences, no prose outside the JSON object
2. Only use subject_name values from the provided batch_subjects list — do not invent subjects
3. Weights for each stream MUST sum to exactly 100.0
4. Each stream gets a unique integer priority (1 = highest priority, no duplicates)
5. Suggest between 2 and 6 streams total — enough to cover business demand, not more
6. Stream names must be specific and professional role titles
7. "reasoning" must explain business alignment in 1-2 sentences, be concise; if a location is provided in the business requirements, mention it in the reasoning

OUTPUT JSON FORMAT (return exactly this structure):
{
  "streams": [
    {
      "name": "Springboot Developer",
      "priority": 1,
      "reasoning": "Primary demand from business requirements for Java backend microservices development.",
      "weights": [
        {"subject_name": "java", "weight_pct": 55.0},
        {"subject_name": "sql", "weight_pct": 25.0},
        {"subject_name": "agile", "weight_pct": 20.0}
      ]
    },
    {
      "name": "Python AI/ML Engineer",
      "priority": 2,
      "reasoning": "Growing need for AI/ML capabilities in the organisation's data products.",
      "weights": [
        {"subject_name": "python", "weight_pct": 50.0},
        {"subject_name": "aiml", "weight_pct": 35.0},
        {"subject_name": "sql", "weight_pct": 15.0}
      ]
    }
  ]
}"""


def _build_user_prompt(
    batch_name: str,
    subjects: list[str],
    business_requirements: list[dict],
    existing_streams: list[str],
    extra_context: str | None,
) -> str:
    if business_requirements:
        br_lines = []
        for br in business_requirements:
            location_str = br.get("location") or "Not specified"
            br_lines.append(f"Business Requirement: {br['title']} | Location: {location_str}")
            for s in br.get("streams", []):
                roles = ", ".join(json.loads(s.get("roles_needed", "[]"))) or "N/A"
                subjs = ", ".join(json.loads(s.get("subjects_needed", "[]"))) or "N/A"
                mandatory = "Yes" if s.get("is_mandatory") else "No"
                br_lines.append(
                    f"  - Stream: {s['name']} | Roles needed: {roles} | "
                    f"Subjects: {subjs} | Mandatory: {mandatory}"
                )
        br_text = "\n".join(br_lines)
    else:
        br_text = "No specific business requirements on record — use the batch subjects to infer likely streams."

    existing_text = ", ".join(existing_streams) if existing_streams else "None"

    prompt = (
        f"Batch Name: {batch_name}\n"
        f"Available Subjects in this Batch: {', '.join(subjects)}\n"
        f"Streams Already Configured (do NOT duplicate these): {existing_text}\n\n"
        f"Business Requirements:\n{br_text}\n"
    )
    if extra_context:
        prompt += f"\nAdditional Context from Admin:\n{extra_context}\n"

    prompt += (
        "\nBased on the information above, suggest appropriate training streams. "
        "Remember: any Java-related stream must be named 'Springboot Developer'. "
        "Return only valid JSON."
    )
    return prompt


def _extract_json(text: str) -> dict:
    text = text.strip()
    # Strip markdown code fences if the model adds them
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"```\s*$", "", text, flags=re.MULTILINE)
    text = text.strip()
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        return json.loads(match.group())
    raise ValueError("No valid JSON object found in AI response")


def _normalise_weights(weights: list[dict], valid_subjects: set[str]) -> list[dict]:
    filtered = [
        {"subject_name": w["subject_name"].strip().lower(), "weight_pct": float(w["weight_pct"])}
        for w in weights
        if str(w.get("subject_name", "")).strip().lower() in valid_subjects
    ]
    if not filtered:
        return filtered
    total = sum(w["weight_pct"] for w in filtered)
    if total <= 0:
        even = round(100.0 / len(filtered), 2)
        for w in filtered:
            w["weight_pct"] = even
        diff = round(100.0 - even * len(filtered), 2)
        filtered[-1]["weight_pct"] = round(filtered[-1]["weight_pct"] + diff, 2)
    elif abs(total - 100.0) > 0.05:
        for w in filtered:
            w["weight_pct"] = round(w["weight_pct"] / total * 100, 2)
        diff = round(100.0 - sum(w["weight_pct"] for w in filtered), 2)
        filtered[-1]["weight_pct"] = round(filtered[-1]["weight_pct"] + diff, 2)
    return filtered


async def generate_stream_suggestions(
    batch_name: str,
    subjects: list[str],
    business_requirements: list[dict],
    existing_streams: list[str],
    extra_context: str | None = None,
) -> list[dict]:
    user_prompt = _build_user_prompt(
        batch_name, subjects, business_requirements, existing_streams, extra_context
    )

    # Use the OpenAI-compatible endpoint that Ollama exposes at /v1/chat/completions
    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "temperature": 0.25,
        "max_tokens": 4096,
    }

    async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT) as client:
        resp = await client.post(
            f"{settings.OLLAMA_BASE_URL}/v1/chat/completions",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Ollama returned HTTP {e.response.status_code}: {e.response.text[:300]}"
            ) from e
        data = resp.json()

    # OpenAI-compatible response: choices[0].message.content
    # gpt-oss:20b is a reasoning model — it writes thinking into "reasoning" and
    # the final answer into "content". Both fields must be present.
    try:
        msg = data["choices"][0]["message"]
        content = msg.get("content") or ""
        # Fallback: if content is empty, the model ran out of tokens during reasoning
        if not content.strip():
            raise RuntimeError(
                "Model returned empty content — likely ran out of tokens during reasoning. "
                f"finish_reason={data['choices'][0].get('finish_reason')}"
            )
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Unexpected Ollama response shape: {str(data)[:300]}") from e
    parsed = _extract_json(content)

    raw_streams = parsed.get("streams", [])
    if not isinstance(raw_streams, list) or not raw_streams:
        raise ValueError("AI returned no stream suggestions")

    valid_subjects = set(s.lower() for s in subjects)
    seen_priorities: set[int] = set()
    result: list[dict] = []

    for raw in raw_streams:
        name = str(raw.get("name", "")).strip()
        if not name:
            continue

        priority = int(raw.get("priority", 0))
        # Resolve priority collisions deterministically
        while priority in seen_priorities:
            priority += 1
        seen_priorities.add(priority)

        reasoning = str(raw.get("reasoning", "")).strip() or (
            "AI-suggested stream based on batch subjects and business requirements."
        )

        weights = _normalise_weights(raw.get("weights", []), valid_subjects)

        result.append({
            "name": name,
            "priority": priority,
            "reasoning": reasoning,
            "weights": weights,
        })

    return result
