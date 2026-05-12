package com.tcs.IntelliStreamDeco.service;

import com.tcs.IntelliStreamDeco.dto.DpiRequest;
import com.tcs.IntelliStreamDeco.entity.DpiRecord;
import com.tcs.IntelliStreamDeco.repository.DpiRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DpiService {

    private final DpiRecordRepository repository;

    public DpiRecord save(DpiRequest request) {
        DpiRecord record = new DpiRecord(
                request.getTraineeId(),
                request.getBatchName(),
                request.getTraineeName(),
                request.getDpi()
        );
        return repository.save(record);
    }

    public List<DpiRecord> getAll() {
        return repository.findAll();
    }

    public Optional<DpiRecord> getByTraineeId(String traineeId) {
        return repository.findById(traineeId);
    }

    public List<DpiRecord> getByBatchName(String batchName) {
        return repository.findByBatchName(batchName);
    }
}
