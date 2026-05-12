package com.tcs.IntelliStreamDeco.service;

import com.tcs.IntelliStreamDeco.dto.SubjectScoreRequest;
import com.tcs.IntelliStreamDeco.entity.SubjectScore;
import com.tcs.IntelliStreamDeco.repository.SubjectScoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SubjectScoreService {

    private final SubjectScoreRepository repository;

    public SubjectScore save(SubjectScoreRequest request) {
        SubjectScore score = new SubjectScore(
                null,
                request.getBatchName(),
                request.getTraineeId(),
                request.getTraineeName(),
                request.getSubjectName(),
                request.getSubjectId(),
                request.getExamName(),
                request.getScore()
        );
        return repository.save(score);
    }

    public List<SubjectScore> getAll() {
        return repository.findAll();
    }

    public Optional<SubjectScore> getById(UUID id) {
        return repository.findById(id);
    }

    public List<SubjectScore> getByTraineeId(String traineeId) {
        return repository.findByTraineeId(traineeId);
    }

    public List<SubjectScore> getByBatchName(String batchName) {
        return repository.findByBatchName(batchName);
    }
}
