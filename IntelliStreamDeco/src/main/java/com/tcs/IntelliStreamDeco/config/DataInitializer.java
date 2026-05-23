package com.tcs.IntelliStreamDeco.config;

import com.tcs.IntelliStreamDeco.entity.Batch;
import com.tcs.IntelliStreamDeco.entity.DpiRecord;
import com.tcs.IntelliStreamDeco.entity.SubjectScore;
import com.tcs.IntelliStreamDeco.repository.BatchRepository;
import com.tcs.IntelliStreamDeco.repository.DpiRecordRepository;
import com.tcs.IntelliStreamDeco.repository.SubjectScoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final BatchRepository batchRepository;
    private final DpiRecordRepository dpiRecordRepository;
    private final SubjectScoreRepository subjectScoreRepository;

    @Override
    public void run(String... args) {
        if (batchRepository.count() > 0) return;

        List<String> subjects = List.of("Java", "Python", "AIML", "SQL", "Agile");

        batchRepository.save(new Batch("Batch 1", 10, subjects));
        batchRepository.save(new Batch("Batch 2", 10, subjects));

        // Trainee data: id, name, batch, dpi, location
        Object[][] trainees = {
            {"EMP001", "Arjun Sharma",       "Batch 1", 4.8, "Chennai"},
            {"EMP002", "Priya Nair",          "Batch 1", 3.9, "Bangalore"},
            {"EMP003", "Rahul Gupta",         "Batch 1", 4.2, "Hyderabad"},
            {"EMP004", "Sneha Patel",         "Batch 1", 2.7, "Mumbai"},
            {"EMP005", "Vikram Iyer",         "Batch 1", 4.5, "Pune"},
            {"EMP006", "Ananya Das",          "Batch 1", 3.1, "Chennai"},
            {"EMP007", "Rohan Mehta",         "Batch 1", 4.9, "Bangalore"},
            {"EMP008", "Divya Krishnan",      "Batch 1", 2.3, "Hyderabad"},
            {"EMP009", "Karan Singh",         "Batch 1", 3.6, "Delhi"},
            {"EMP010", "Meera Reddy",         "Batch 1", 4.1, "Mumbai"},
            {"EMP011", "Suresh Kumar",        "Batch 2", 3.8, "Pune"},
            {"EMP012", "Lakshmi Venkat",      "Batch 2", 4.6, "Chennai"},
            {"EMP013", "Aditya Joshi",        "Batch 2", 2.5, "Bangalore"},
            {"EMP014", "Pooja Desai",         "Batch 2", 4.3, "Hyderabad"},
            {"EMP015", "Nikhil Rao",          "Batch 2", 3.4, "Mumbai"},
            {"EMP016", "Swati Mishra",        "Batch 2", 4.7, "Pune"},
            {"EMP017", "Amit Tiwari",         "Batch 2", 2.9, "Delhi"},
            {"EMP018", "Kavitha Pillai",      "Batch 2", 4.0, "Chennai"},
            {"EMP019", "Deepak Srivastava",   "Batch 2", 3.3, "Bangalore"},
            {"EMP020", "Preeti Dubey",        "Batch 2", 4.4, "Hyderabad"},
        };

        for (Object[] t : trainees) {
            DpiRecord dpi = new DpiRecord();
            dpi.setTraineeId((String) t[0]);
            dpi.setBatchName((String) t[2]);
            dpi.setTraineeName((String) t[1]);
            dpi.setDpi((Double) t[3]);
            dpi.setLocation((String) t[4]);
            dpiRecordRepository.save(dpi);
        }

        // Scores: subject -> [exam1score1..10, exam2score1..10]
        // Order matches trainee rows above
        Object[][][] scores = {
            // Java
            {{"Java", "Java-01"}, {88, 76, 91, 62, 85, 70, 95, 55, 78, 83, 74, 92, 58, 87, 69, 96, 61, 80, 67, 89}},
            {{"Java", "Java-02"}, {82, 71, 88, 59, 90, 65, 97, 52, 75, 81, 78, 93, 54, 84, 72, 98, 63, 77, 70, 86}},
            // Python
            {{"Python", "Python-01"}, {79, 85, 72, 66, 88, 74, 91, 60, 83, 77, 69, 94, 57, 80, 75, 89, 64, 82, 71, 90}},
            {{"Python", "Python-02"}, {84, 80, 68, 73, 92, 78, 89, 57, 86, 74, 72, 96, 61, 83, 70, 91, 67, 85, 68, 87}},
            // AIML
            {{"AIML", "AIML-01"}, {75, 68, 82, 55, 87, 71, 93, 50, 79, 76, 65, 90, 53, 88, 66, 94, 59, 78, 64, 85}},
            {{"AIML", "AIML-02"}, {80, 72, 85, 58, 89, 69, 95, 53, 82, 79, 70, 88, 56, 91, 68, 96, 62, 81, 66, 88}},
            // SQL
            {{"SQL", "SQL-01"}, {91, 78, 86, 64, 83, 76, 89, 58, 74, 87, 80, 95, 62, 78, 73, 93, 56, 84, 69, 92}},
            {{"SQL", "SQL-02"}, {87, 74, 90, 61, 86, 72, 92, 55, 77, 84, 76, 97, 59, 81, 70, 95, 60, 87, 65, 90}},
            // Agile
            {{"Agile", "Agile-01"}, {85, 90, 77, 68, 80, 82, 88, 63, 72, 79, 83, 91, 60, 85, 78, 89, 65, 76, 73, 86}},
            {{"Agile", "Agile-02"}, {89, 86, 80, 71, 84, 79, 90, 66, 75, 82, 81, 93, 63, 88, 76, 92, 68, 79, 71, 88}},
        };

        String[] subjectIds = {"SUB001", "SUB001", "SUB002", "SUB002", "SUB003", "SUB003", "SUB004", "SUB004", "SUB005", "SUB005"};

        for (int i = 0; i < scores.length; i++) {
            String subjectName = (String) scores[i][0][0];
            String examName    = (String) scores[i][0][1];
            Object[] examScores = scores[i][1];
            String subjectId   = subjectIds[i];

            for (int j = 0; j < trainees.length; j++) {
                String traineeId   = (String) trainees[j][0];
                String traineeName = (String) trainees[j][1];
                String batchName   = (String) trainees[j][2];
                double score       = ((Number) examScores[j]).doubleValue();

                subjectScoreRepository.save(new SubjectScore(
                    null,
                    batchName,
                    traineeId,
                    traineeName,
                    subjectName,
                    subjectId,
                    examName,
                    score
                ));
            }
        }
    }
}
