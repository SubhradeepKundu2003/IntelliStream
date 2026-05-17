import json
import re

import httpx

from config import settings

SYSTEM_PROMPT = """You are an expert training stream allocation advisor for IntelliStream, a corporate IT training management platform.

Your role: review the algorithmic stream allocation for each trainee and provide an expert recommendation — either affirming the algorithm's choice or suggesting a better-fit stream.

EVALUATION CRITERIA:
- Subject alignment: The trainee's highest-scoring subjects should align with the stream's focus
- DPI score (0–5): Values ≥ 4 are excellent, 2.5–4 are acceptable, < 2.5 are concerning
- Score gap: If the top stream-fit score beats the algorithm's choice by > 15 points, that warrants a different recommendation
- Business demand: Higher-priority streams have greater business need
- Holistic judgement: Avoid recommending a change for marginal differences (< 5 points)

CONFIDENCE LEVELS:
- "high": Clear-cut case — obvious alignment or misalignment, score gap > 15 points
- "medium": Reasonable case — moderate evidence, score gap 5–15 points
- "low": Borderline — minor differences, algorithm's choice is likely acceptable

STRICT OUTPUT RULES:
1. Output MUST be a valid JSON array — no markdown, no code fences, no prose outside the JSON
2. Include exactly one entry per trainee, in the same order as the input
3. "agrees" must be a boolean: true to affirm the algorithm, false to recommend a different stream
4. "recommended_stream" must be null when agrees=true; when agrees=false it must be a name from the Available Streams list
5. "reasoning" must be 1–2 concise sentences explaining the key factor
6. "confidence" must be one of: "high", "medium", "low"

OUTPUT FORMAT (return exactly this structure):
[
  {
    "employee_id": "E001",
    "agrees": true,
    "recommended_stream": null,
    "confidence": "high",
    "reasoning": "Strong Java and SQL scores align perfectly with Springboot Developer. DPI of 4.2 confirms consistent high performance."
  },
  {
    "employee_id": "E002",
    "agrees": false,
    "recommended_stream": "Python AI/ML Engineer",
    "confidence": "medium",
    "reasoning": "Python and AI/ML scores (88, 82) substantially outperform Java scores (54). The algorithm's Springboot suggestion does not reflect the trainee's strongest domain."
  }
]"""


def _build_user_prompt(
    batch_name: str,
    trainees: list[dict],
    streams: list[str],
    business_requirements: list[dict],
) -> str:
    if business_requirements:
        br_lines = []
        for br in business_requirements:
            location = br.get("location") or "N/A"
            br_lines.append(f"  - {br['title']} (Location: {location})")
            for s in br.get("streams", []):
                mandatory = "mandatory" if s.get("is_mandatory") else "optional"
                roles = ", ".join(json.loads(s.get("roles_needed", "[]"))) or "N/A"
                br_lines.append(f"    • {s['name']} [{mandatory}] — roles: {roles}")
        br_text = "\n".join(br_lines)
    else:
        br_text = "  No specific business requirements on record."

    streams_text = ", ".join(streams) if streams else "None defined"
    trainees_json = json.dumps(trainees, indent=2)

    return (
        f"Batch: {batch_name}\n\n"
        f"Available Streams: {streams_text}\n\n"
        f"Business Requirements:\n{br_text}\n\n"
        f"Trainees to evaluate:\n{trainees_json}\n\n"
        "Evaluate each trainee's algorithmic allocation. Only use stream names from the Available Streams "
        "list when recommending a change. Return only the JSON array — no markdown, no extra text."
    )


def _extract_json_array(text: str) -> list:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"```\s*$", "", text, flags=re.MULTILINE)
    text = text.strip()
    match = re.search(r"\[[\s\S]*\]", text)
    if match:
        return json.loads(match.group())
    # Fallback: model wrapped array in an object
    obj_match = re.search(r"\{[\s\S]*\}", text)
    if obj_match:
        obj = json.loads(obj_match.group())
        for key in ("recommendations", "trainees", "results", "allocations"):
            if isinstance(obj.get(key), list):
                return obj[key]
    raise ValueError("No valid JSON array found in AI response")


async def generate_allocation_recommendations(
    batch_name: str,
    trainees: list[dict],
    streams: list[str],
    business_requirements: list[dict],
) -> list[dict]:
    if not trainees:
        return []

    user_prompt = _build_user_prompt(batch_name, trainees, streams, business_requirements)

    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "temperature": 0.2,
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

    try:
        msg = data["choices"][0]["message"]
        content = msg.get("content") or ""
        if not content.strip():
            raise RuntimeError(
                "Model returned empty content — likely ran out of tokens during reasoning. "
                f"finish_reason={data['choices'][0].get('finish_reason')}"
            )
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Unexpected Ollama response shape: {str(data)[:300]}") from e

    raw_list = _extract_json_array(content)
    if not isinstance(raw_list, list):
        raise ValueError("AI returned a non-array response")

    valid_stream_names_lower = {s.lower(): s for s in streams}
    result: list[dict] = []

    for item in raw_list:
        employee_id = str(item.get("employee_id", "")).strip()
        if not employee_id:
            continue

        agrees = bool(item.get("agrees", True))
        recommended_stream = item.get("recommended_stream")

        if recommended_stream:
            recommended_stream = str(recommended_stream).strip()
            # Normalise to the canonical casing from the streams list
            canonical = valid_stream_names_lower.get(recommended_stream.lower())
            if canonical:
                recommended_stream = canonical
            else:
                # Unknown stream name — fall back to agreeing
                recommended_stream = None
                agrees = True
        else:
            recommended_stream = None

        if agrees:
            recommended_stream = None

        confidence = str(item.get("confidence", "medium")).strip().lower()
        if confidence not in ("high", "medium", "low"):
            confidence = "medium"

        reasoning = str(item.get("reasoning", "")).strip() or "No reasoning provided."

        result.append({
            "employee_id": employee_id,
            "agrees": agrees,
            "recommended_stream": recommended_stream,
            "confidence": confidence,
            "reasoning": reasoning,
        })

    return result
