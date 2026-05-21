#!/usr/bin/env node

// Test Java detection directly
import { checkJavaInstalled } from '../src/server/services/suwayomi/utils.js';

console.log('Testing Java detection...');

checkJavaInstalled().then(result => {
  console.log('Java 21+ installed:', result);
  process.exit(result ? 0 : 1);
}).catch(error => {
  console.error('Error checking Java:', error);
  process.exit(1);
});