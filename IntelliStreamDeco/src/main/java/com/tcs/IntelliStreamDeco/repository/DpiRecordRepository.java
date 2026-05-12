package com.tcs.IntelliStreamDeco.repository;

import com.tcs.IntelliStreamDeco.entity.DpiRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DpiRecordRepository extends JpaRepository<DpiRecord, String> {
    List<DpiRecord> findByBatchName(String batchName);
}
