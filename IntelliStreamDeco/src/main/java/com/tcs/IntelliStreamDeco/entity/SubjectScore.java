package com.tcs.IntelliStreamDeco.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Entity
@Table(name = "subject_scores")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SubjectScore {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "batch_name", nullable = false)
    private String batchName;

    @Column(name = "trainee_id", nullable = false)
    private String traineeId;

    @Column(name = "trainee_name", nullable = false)
    private String traineeName;

    @Column(name = "subject_name", nullable = false)
    private String subjectName;

    @Column(name = "subject_id")
    private String subjectId;

    @Column(name = "exam_name")
    private String examName;

    @Column(nullable = false)
    private Double score;
}
