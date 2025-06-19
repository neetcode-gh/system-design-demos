import org.apache.flink.api.common.functions.MapFunction;
import org.apache.flink.api.java.tuple.Tuple2;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.functions.windowing.ProcessWindowFunction;
import org.apache.flink.streaming.api.windowing.assigners.SlidingProcessingTimeWindows;
import org.apache.flink.streaming.api.windowing.time.Time;
import org.apache.flink.streaming.api.windowing.windows.TimeWindow;
import org.apache.flink.util.Collector;
import org.apache.flink.api.common.typeinfo.TypeHint;

import java.util.*;

/**
 * Reads item-IDs from a TCP socket, keeps a sliding 1-minute / 5-second-slide window,
 * and prints the top-5 most-viewed items for every window.
 *  Build: mvn clean package -DskipTests
 *  Run: java -jar target/topk-1.0-SNAPSHOT.jar
 */
public class TopKWindowedAggregator extends
        ProcessWindowFunction<
                Tuple2<String, Integer>,          // input (itemId, 1)
                Map<String, Integer>,             // output {itemId -> count}
                String,                           // key type
                TimeWindow> {

    private static final int K = 5;  // Top K items

    public static void main(String[] args) throws Exception {
        // Set up the Flink streaming execution environment
        final StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

        // Source: Create a stream of item view events (for simplicity, use socket input)
        DataStream<String> input = env.socketTextStream("localhost", 9999);

        // Map input stream to item counts (Tuple2<item_id, 1>)
        DataStream<Tuple2<String, Integer>> itemCounts = input
                .map(item -> new Tuple2<>(item, 1))
                .returns(new TypeHint<Tuple2<String, Integer>>(){});

        // Apply a sliding window of 1 minute with a slide interval of 5 seconds
        DataStream<Map<String, Integer>> topKStream = itemCounts
                .keyBy(tuple -> tuple.f0)  // Key by item_id
                .window(SlidingProcessingTimeWindows.of(Time.minutes(1), Time.seconds(5)))  // Sliding window
                .process(new TopKWindowedAggregator());

        // Print the top K items to the console
        System.out.println("Top K Stream at minute: " + new Date().toString());
        topKStream.print();

        // Execute the Flink job
        env.execute("Top K Viewed Items with Sliding Window");
    }

    @Override
    public void process(
            String key,
            Context ctx,
            Iterable<Tuple2<String, Integer>> elements,
            Collector<Map<String, Integer>> out) {

        // 1.  Count views for every item in this window
        Map<String, Integer> counts = new HashMap<>();
        for (Tuple2<String, Integer> e : elements) {
            counts.put(e.f0, counts.getOrDefault(e.f0, 0) + e.f1);
        }

        // 2.  Keep only the best K items with a min-heap
        PriorityQueue<Map.Entry<String, Integer>> heap =
                new PriorityQueue<>(Comparator.comparingInt(Map.Entry::getValue)); // min-heap

        for (Map.Entry<String, Integer> entry : counts.entrySet()) {
            heap.offer(entry);              // add current item
            if (heap.size() > K) {          // if > K, drop the smallest
                heap.poll();
            }
        }

        // 3.  Dump heap contents into a result map (largest first)
        List<Map.Entry<String, Integer>> topK = new ArrayList<>(heap);
        topK.sort((a, b) -> b.getValue().compareTo(a.getValue())); // descending

        Map<String, Integer> result = new LinkedHashMap<>();
        for (Map.Entry<String, Integer> e : topK) {
            result.put(e.getKey(), e.getValue());
        }

        out.collect(result);   // emit Top-K for this window
    }
}
