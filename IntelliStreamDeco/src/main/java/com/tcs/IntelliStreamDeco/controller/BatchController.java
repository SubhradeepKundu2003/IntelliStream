package com.tcs.IntelliStreamDeco.controller;

import com.tcs.IntelliStreamDeco.dto.BatchRequest;
import com.tcs.IntelliStreamDeco.entity.Batch;
import com.tcs.IntelliStreamDeco.service.BatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/subjects")
@RequiredArgsConstructor
public class BatchController {

    private final BatchService service;

    @PostMapping
    public ResponseEntity<Batch> create(@RequestBody BatchRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.save(request));
    }

    @GetMapping
    public ResponseEntity<List<Batch>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/{batchName}")
    public ResponseEntity<Batch> getByBatchName(@PathVariable String batchName) {
        return service.getByBatchName(batchName)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{batchName}")
    public ResponseEntity<Batch> update(@PathVariable String batchName, @RequestBody BatchRequest request) {
        return service.update(batchName, request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{batchName}")
    public ResponseEntity<Void> delete(@PathVariable String batchName) {
        return service.delete(batchName)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
