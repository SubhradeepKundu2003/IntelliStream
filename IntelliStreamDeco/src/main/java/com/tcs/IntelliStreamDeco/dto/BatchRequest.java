package com.tcs.IntelliStreamDeco.dto;

import lombok.Data;

import java.util.List;

@Data
public class BatchRequest {
    private String batchName;
    private List<String> subjects;
}
