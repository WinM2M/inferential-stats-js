# **Contributing to inferential-stats-js**

First off, thank you for considering contributing to @winm2m/inferential-stats-js\!

This project aims to bring advanced, SPSS-level inferential statistics directly to the web browser using WebAssembly (Pyodide) and Web Workers. Your contributions—whether they are bug reports, feature requests, documentation improvements, or code pull requests—are highly valued and appreciated.

## **Table of Contents**

1. [Reporting Bugs](https://www.google.com/search?q=%23reporting-bugs)  
2. [Suggesting Enhancements](https://www.google.com/search?q=%23suggesting-enhancements)  
3. [Local Development Setup](https://www.google.com/search?q=%23local-development-setup)  
4. [Architectural Guidelines](https://www.google.com/search?q=%23architectural-guidelines)  
5. [Pull Request Process](https://www.google.com/search?q=%23pull-request-process)  
6. [Policy on AI Coding Assistants](https://www.google.com/search?q=%23policy-on-ai-coding-assistants)

## **Reporting Bugs**

If you encounter a bug, please check the [Issue Tracker](https://www.google.com/search?q=https://github.com/winm2m/inferential-stats-js/issues) to see if it has already been reported. If not, please open a new issue and include:

* **Browser & OS:** (e.g., Chrome 120 on macOS)  
* **Error Logs:** Any console errors, especially those related to Web Workers, Pyodide, or Out-Of-Memory (OOM) exceptions.  
* **Reproducible Example:** A minimal dataset (JSON) or a CodePen/CodeSandbox link demonstrating the issue.

## **Suggesting Enhancements**

We are always looking to expand the statistical capabilities of this SDK. If you have an idea for a new feature (e.g., adding a new Python statistical model):

1. Open an issue describing the proposed feature.  
2. Explain the **mathematical concept** and why it is useful for the ecosystem.  
3. Suggest the specific Python library/function (e.g., scikit-learn, statsmodels) that could be used via Pyodide to implement it.

## **Local Development Setup**

To set up the project locally and start coding:

1. **Fork the repository** and clone it to your local machine.  
2. **Install dependencies:**  
   npm install

3. **Build the SDK:**  
   npm run build

4. **Run tests:** Make sure all existing tests pass before making changes.  
   npm run test

## **Architectural Guidelines**

When contributing to the codebase, please keep the following core architectural principles in mind:

* **Separation of Concerns:** The main thread (SDK API) should never be blocked. All heavy mathematical operations must be implemented inside the Web Worker (src/worker/stats-worker.ts).  
* **Buffer-based Communication:** To prevent JSON serialization bottlenecks and memory leaks with large datasets, always ensure data is transferred between the main thread and the worker using lightweight binary formats (e.g., ArrayBuffer, TypedArray).  
* **Memory Management (Garbage Collection):** When converting buffers to Python Pandas DataFrames inside the worker, memory usage spikes. You **must** explicitly free Python proxy objects (using .destroy(), del, or gc.collect()) before returning the result to the main thread.

## **Pull Request Process**

1. Create a new branch from main (e.g., feature/add-manova or bugfix/fix-worker-memory-leak).  
2. Write your code and ensure it adheres to the existing TypeScript and Python bridging conventions.  
3. Add or update unit tests (\_\_tests\_\_/) to verify your changes.  
4. Update the README.md if you are adding a new public API or statistical feature.  
5. Open a Pull Request (PR) and provide a clear description of the changes and the problem they solve.  
6. A maintainer will review your PR, run CI tests, and provide feedback.

## **Policy on AI Coding Assistants**

We embrace modern software engineering practices. Using AI coding assistants (e.g., GitHub Copilot, Claude, ChatGPT) to help write, refactor, or optimize your code is **fully permitted and encouraged**.

However, by submitting a Pull Request, you agree to the following:

* **Accountability:** You, the contributor, are 100% responsible for the accuracy, logic, and integrity of the code. "The AI generated it" is not an acceptable excuse for statistical inaccuracies or memory leaks.  
* **Mathematical Validation:** If you use AI to implement statistical formulas or Python library mappings, you must rigorously cross-check the results against native Python environments before submitting the PR.

Thank you for your time and expertise. Together, we can make advanced statistics accessible to every web developer\!
