package com.tcs.IntelliStreamDeco.dto;

import lombok.Data;

@Data
public class DpiRequest {
    private String traineeId;
    private String batchName;
    private String traineeName;
    private Double dpi;
    private String location;
    private String subBatch;
}
