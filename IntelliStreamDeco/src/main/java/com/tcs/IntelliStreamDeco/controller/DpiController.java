package com.tcs.IntelliStreamDeco.controller;

import com.tcs.IntelliStreamDeco.dto.DpiRequest;
import com.tcs.IntelliStreamDeco.entity.DpiRecord;
import com.tcs.IntelliStreamDeco.service.DpiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dpi")
@RequiredArgsConstructor
public class DpiController {

    private final DpiService service;

    @PostMapping
    public ResponseEntity<DpiRecord> create(@RequestBody DpiRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.save(request));
    }

    @GetMapping
    public ResponseEntity<List<DpiRecord>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @GetMapping("/{traineeId}")
    public ResponseEntity<DpiRecord> getById(@PathVariable String traineeId) {
        return service.getByTraineeId(traineeId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/batch/{batchName}")
    public ResponseEntity<List<DpiRecord>> getByBatchName(@PathVariable String batchName) {
        return ResponseEntity.ok(service.getByBatchName(batchName));
    }
}
