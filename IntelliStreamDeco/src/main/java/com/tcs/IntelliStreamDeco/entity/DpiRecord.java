package com.tcs.IntelliStreamDeco.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "dpi_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DpiRecord {

    @Id
    @Column(name = "trainee_id")
    private String traineeId;

    @Column(name = "batch_name", nullable = false)
    private String batchName;

    @Column(name = "trainee_name", nullable = false)
    private String traineeName;

    @Column(nullable = false)
    private Double dpi;

    @Column(nullable = true)
    private String location;

    @Column(name = "sub_batch", nullable = true)
    private String subBatch;
}
