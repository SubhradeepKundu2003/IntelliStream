package com.tcs.IntelliStreamDeco.dto;

import lombok.Data;

@Data
public class SubjectScoreRequest {
    private String traineeId;
    private String traineeName;
    private String subjectName;
    private String subjectId;
    private String examName;
    private Double score;
}
