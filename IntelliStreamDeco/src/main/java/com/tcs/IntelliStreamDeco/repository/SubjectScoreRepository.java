package com.tcs.IntelliStreamDeco.repository;

import com.tcs.IntelliStreamDeco.entity.SubjectScore;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SubjectScoreRepository extends JpaRepository<SubjectScore, UUID> {

    List<SubjectScore> findByTraineeId(String traineeId);
}
