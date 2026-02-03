import { parseInductionInput, runInduction, InductionInput } from './index';
import * as fs from 'fs';
import * as path from 'path';

interface TestCase {
    name: string;
    description: string;
    inductionHypothesis: string;
    shouldSucceed: boolean;
}

// Load relations from example.ind
function loadRelations(): string[] {
    const filePath = path.join(__dirname, '../src/example.ind');
    // Try different paths depending on whether we're running from dist or src
    let content: string;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch {
        const altPath = path.join(__dirname, 'example.ind');
        content = fs.readFileSync(altPath, 'utf-8');
    }
    
    const parsed = parseInductionInput(content);
    return parsed.relations;
}

const testCases: TestCase[] = [
    {
        name: 'Sum of first n odd numbers',
        description: 'Σ(2k-1, k=1 to n) = n²',
        inductionHypothesis: 'Sum(Subtract(Mult(k,Constant(2)),Constant(1)),Constant(1),Variable(n)) = Mult(Variable(n),Variable(n))',
        shouldSucceed: true
    },
    {
        name: 'Sum of first n natural numbers',
        description: 'Σ(k, k=1 to n) = n(n+1)/2',
        inductionHypothesis: 'Sum(k,Constant(1),Variable(n)) = Div(Mult(Variable(n),Add(Variable(n),Constant(1))),Constant(2))',
        shouldSucceed: true
    },
    {
        name: 'Sum of constants',
        description: 'Σ(1, k=1 to n) = n',
        inductionHypothesis: 'Sum(Constant(1),Constant(1),Variable(n)) = Variable(n)',
        shouldSucceed: true
    },
    {
        name: 'Sum of 2k',
        description: 'Σ(2k, k=1 to n) = n(n+1)',
        inductionHypothesis: 'Sum(Mult(k,Constant(2)),Constant(1),Variable(n)) = Mult(Variable(n),Add(Variable(n),Constant(1)))',
        shouldSucceed: true
    },
];

interface TestResult {
    name: string;
    passed: boolean;
    expected: boolean;
    details: string;
    duration: number;
}

function runTest(testCase: TestCase, relations: string[]): TestResult {
    const startTime = Date.now();
    
    try {
        // Suppress console output during tests
        const originalLog = console.log;
        const logs: string[] = [];
        console.log = (...args) => logs.push(args.join(' '));
        
        const input: InductionInput = {
            relations,
            inductionHypothesis: testCase.inductionHypothesis
        };
        
        const result = runInduction(input);
        
        console.log = originalLog;
        
        const succeeded = result.successfulBranch !== null;
        const passed = succeeded === testCase.shouldSucceed;
        
        return {
            name: testCase.name,
            passed,
            expected: testCase.shouldSucceed,
            details: succeeded 
                ? `Found proof with ${result.successfulBranchLatex.length} steps`
                : 'No proof found',
            duration: Date.now() - startTime
        };
    } catch (error) {
        console.log = console.log; // Restore in case of error
        return {
            name: testCase.name,
            passed: !testCase.shouldSucceed, // If we expected failure, exception counts as pass
            expected: testCase.shouldSucceed,
            details: `Error: ${error instanceof Error ? error.message : String(error)}`,
            duration: Date.now() - startTime
        };
    }
}

function runAllTests(): void {
    console.log('═'.repeat(60));
    console.log('  INDUCTION PROVER TEST SUITE');
    console.log('═'.repeat(60));
    console.log();
    
    // Load relations from example.ind
    console.log('Loading relations from example.ind...');
    const relations = loadRelations();
    console.log(`Loaded ${relations.length} relations\n`);
    
    const results: TestResult[] = [];
    
    for (const testCase of testCases) {
        process.stdout.write(`Testing: ${testCase.name}... `);
        const result = runTest(testCase, relations);
        results.push(result);
        
        if (result.passed) {
            console.log(`✓ PASSED (${result.duration}ms)`);
        } else {
            console.log(`✗ FAILED (${result.duration}ms)`);
        }
        console.log(`  Description: ${testCase.description}`);
        console.log(`  ${result.details}`);
        console.log();
    }
    
    // Summary
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log('═'.repeat(60));
    console.log('  SUMMARY');
    console.log('═'.repeat(60));
    console.log(`  Total:  ${results.length} tests`);
    console.log(`  Passed: ${passed} ✓`);
    console.log(`  Failed: ${failed} ✗`);
    console.log(`  Time:   ${totalTime}ms`);
    console.log('═'.repeat(60));
    
    if (failed > 0) {
        console.log('\nFailed tests:');
        for (const result of results.filter(r => !r.passed)) {
            console.log(`  - ${result.name}: ${result.details}`);
        }
        process.exit(1);
    } else {
        console.log('\nAll tests passed! 🎉');
        process.exit(0);
    }
}

// Run if this is the main module
if (require.main === module) {
    runAllTests();
}

export { runAllTests, runTest, testCases, TestCase, TestResult };
