# CI/CD Workflows for Testing

This document explains the GitHub Actions workflows set up for automated testing in the Mugiwara-Kaizoku project.

## Available Workflows

### 1. Test Suite (`.github/workflows/test.yml`)

This workflow runs on every push to main/develop branches and on every pull request:

- **Purpose**: Validate code quality and run tests for code changes
- **Triggers**: 
  - Push to `main` or `develop` branches
  - Pull requests to `main` or `develop` branches
  - Manual trigger via GitHub Actions UI
- **Actions**:
  - Run TypeScript type checking
  - Run ESLint
  - For PRs: Run tests only for files changed in the PR
  - For direct pushes: Run all tests
  - Upload coverage reports to Codecov

### 2. Test Coverage (`.github/workflows/coverage.yml`)

This workflow runs weekly to track coverage trends:

- **Purpose**: Monitor test coverage and identify areas needing more tests
- **Triggers**:
  - Weekly schedule (Sunday at midnight)
  - Manual trigger via GitHub Actions UI
- **Actions**:
  - Run all tests with coverage reporting
  - Generate detailed coverage report
  - Create or update coverage report issue
  - Upload coverage to Codecov

### 3. Test on PR Comment (`.github/workflows/test-on-comment.yml`)

This workflow allows running tests by commenting on PRs:

- **Purpose**: Run specific tests without having to push new commits
- **Triggers**: PR comment starting with `/test`
- **Actions**:
  - Parse test command from comment
  - Checkout PR branch
  - Run requested tests
  - Post results as PR comment

## Usage Examples

### Running Tests on PR Comments

You can trigger specific tests by commenting on a PR with commands like:

```
/test
```
Runs all tests

```
/test components/Button
```
Runs tests matching the pattern "components/Button"

```
/test hooks/useAuth
```
Runs tests matching the pattern "hooks/useAuth"

### Viewing Coverage Reports

Weekly coverage reports are posted to a designated GitHub issue. You can:

1. View the most recent report
2. Track coverage trends over time
3. Identify areas with low coverage that need more tests

## Best Practices

1. **PR Tests**: The PR workflow will automatically run tests for files you've changed. You can also manually trigger specific tests using PR comments.

2. **Coverage Goals**: 
   - Functions: 80%
   - Statements: 75%
   - Lines: 75%
   - Branches: 70%

3. **Failing Tests**: If a PR has failing tests, it should not be merged until the issues are resolved.

4. **Test Patterns**: Follow the Test Template Guide when writing new tests to ensure they work properly with the CI system.

## Troubleshooting

### PR Tests Not Running

If tests aren't running on your PR:

1. Make sure the PR is targeting `main` or `develop` branches
2. Check that you've made changes to `.ts` or `.tsx` files
3. Verify that test files exist for the files you've changed

### Test Comments Not Working

If commenting `/test` doesn't trigger tests:

1. Make sure your comment starts exactly with `/test`
2. Check the workflow permissions in the repository settings
3. Look at the GitHub Actions logs for errors

### Low Coverage

If your PR decreases test coverage:

1. Add tests for the new code you've written
2. Consider using the [test templates](../../src/test/templates/) to create tests