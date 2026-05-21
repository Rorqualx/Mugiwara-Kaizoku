/**
 * A/B Testing Framework - Report Generator
 *
 * Generates human-readable reports from experiment results.
 */

import type { ExperimentResults } from './types';

/**
 * Generate comprehensive experiment report
 *
 * @param experiment - Experiment results to report on
 * @returns Markdown-formatted report string
 */
export function generateExperimentReport(experiment: ExperimentResults): string {
  const report = `
# A/B Test Report: ${experiment.config.name}
## Experiment Details
- ID: ${experiment.experimentId}
- Start: ${experiment.startTime}
- End: ${experiment.endTime ?? 'Ongoing'}
- Duration: ${
    experiment.endTime
      ? ((experiment.endTime.getTime() - experiment.startTime.getTime()) / (1000 * 60 * 60)).toFixed(2) + ' hours'
      : 'Ongoing'
  }
## Configuration
- Traffic Split: ${experiment.config.trafficSplit}% to ML variant
- Minimum Sample Size: ${experiment.config.minSampleSize}
- Confidence Level: ${experiment.config.confidenceLevel}
## Results
### Variant A: ${experiment.variantA.name}
- Samples: ${experiment.variantA.samples}
- Success Rate: ${(experiment.variantA.successRate * 100).toFixed(2)}%
- Average Accuracy: ${(experiment.variantA.averageAccuracy * 100).toFixed(2)}%
- Average Execution Time: ${experiment.variantA.averageExecutionTime.toFixed(2)}ms
- Errors: ${experiment.variantA.errors}
### Variant B: ${experiment.variantB.name}
- Samples: ${experiment.variantB.samples}
- Success Rate: ${(experiment.variantB.successRate * 100).toFixed(2)}%
- Average Accuracy: ${(experiment.variantB.averageAccuracy * 100).toFixed(2)}%
- Average Confidence: ${(experiment.variantB.averageConfidence * 100).toFixed(2)}%
- Average Execution Time: ${experiment.variantB.averageExecutionTime.toFixed(2)}ms
- Errors: ${experiment.variantB.errors}
## Statistical Analysis
- Winner: ${experiment.winner ?? 'Not determined'}
- Statistical Significance (p-value): ${experiment.statisticalSignificance?.toFixed(4) ?? 'N/A'}
## Recommendations
${experiment.recommendations.map((r) => `- ${r}`).join('\n')}
`;
  return report;
}
