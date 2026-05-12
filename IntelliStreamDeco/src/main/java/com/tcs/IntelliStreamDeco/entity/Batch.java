package com.tcs.IntelliStreamDeco.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "batches")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Batch {

    @Id
    @Column(name = "batch_name")
    private String batchName;

    @Column(name = "trainee_count", nullable = false)
    private int traineeCount = 0;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "batch_subjects",
            joinColumns = @JoinColumn(name = "batch_name")
    )
    @Column(name = "subject_name")
    private List<String> subjects = new ArrayList<>();
}
