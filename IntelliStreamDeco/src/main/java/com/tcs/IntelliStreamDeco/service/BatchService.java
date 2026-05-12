package com.tcs.IntelliStreamDeco.service;

import com.tcs.IntelliStreamDeco.dto.BatchRequest;
import com.tcs.IntelliStreamDeco.entity.Batch;
import com.tcs.IntelliStreamDeco.repository.BatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class BatchService {

    private final BatchRepository repository;

    public Batch save(BatchRequest request) {
        Batch batch = new Batch(request.getBatchName(), request.getTraineeCount(), request.getSubjects());
        return repository.save(batch);
    }

    public List<Batch> getAll() {
        return repository.findAll();
    }

    public Optional<Batch> getByBatchName(String batchName) {
        return repository.findById(batchName);
    }

    public Optional<Batch> update(String batchName, BatchRequest request) {
        return repository.findById(batchName).map(batch -> {
            batch.setTraineeCount(request.getTraineeCount());
            batch.setSubjects(request.getSubjects());
            return repository.save(batch);
        });
    }

    public boolean delete(String batchName) {
        if (!repository.existsById(batchName)) return false;
        repository.deleteById(batchName);
        return true;
    }
}
