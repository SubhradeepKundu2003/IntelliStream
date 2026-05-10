package com.tcs.IntelliStreamDeco.repository;

import com.tcs.IntelliStreamDeco.entity.Batch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BatchRepository extends JpaRepository<Batch, String> {
}
