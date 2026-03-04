import java.util.*;

public class bplate {

    protected Scanner scanner;

    public bplate() {
        init();
    }

    protected void init() {
        scanner = new Scanner(System.in);
        System.out.println("Program Started");
    }

    protected void close() {
        scanner.close();
    }
}