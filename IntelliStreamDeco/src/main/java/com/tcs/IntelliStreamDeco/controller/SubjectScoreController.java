package com.tcs.IntelliStreamDeco.controller;

import com.tcs.IntelliStreamDeco.dto.SubjectScoreRequest;
import com.tcs.IntelliStreamDeco.entity.SubjectScore;
import com.tcs.IntelliStreamDeco.service.SubjectScoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/scores")
@RequiredArgsConstructor
public class SubjectScoreController {

    private final SubjectScoreService service;

    @PostMapping
    public ResponseEntity<SubjectScore> create(@RequestBody SubjectScoreRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.save(request));
    }

    @GetMapping
    public ResponseEntity<List<SubjectScore>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SubjectScore> getById(@PathVariable UUID id) {
        return service.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/trainee/{traineeId}")
    public ResponseEntity<List<SubjectScore>> getByTraineeId(@PathVariable String traineeId) {
        return ResponseEntity.ok(service.getByTraineeId(traineeId));
    }

    @GetMapping("/batch/{batchName}")
    public ResponseEntity<List<SubjectScore>> getByBatchName(@PathVariable String batchName) {
        return ResponseEntity.ok(service.getByBatchName(batchName));
    }
}
