/**
 * FirstTimeSetup component for initial system configuration
 *
 * This component handles the first-time setup process for the application,
 * including admin account creation and initial system configuration.
 * Features include:
 * - Step-by-step setup wizard
 * - Form validation and error handling
 * - Secure admin account creation
 * - Automatic login redirection
 *
 * @remarks
 * Setup Flow:
 * 1. Admin Account Creation:
 *    - Username validation (min 3 chars)
 *    - Email validation
 *    - Password validation (min 6 chars)
 *    - Password confirmation
 * 2. Setup Completion:
 *    - Success confirmation
 *    - Automatic login redirection
 *
 * Error Handling:
 * - Form validation errors
 * - API submission errors
 * - Server-side validation
 * - Network error recovery
 * - Alternative setup options
 *
 * @example
 * ```jsx
 * // Basic usage in setup page
 * function SetupPage() {
 *   return (
 *     <div>
 *       <FirstTimeSetup />
 *     </div>
 *   );
 * }
 * ```
 */
import React from "react";
import { useState, useEffect } from 'react';

import { TextInput, PasswordInput, Paper, Title, Container, Button, Text, Alert, Box, Stepper, Divider, LoadingOverlay } from '@mantine/core';
import { useForm } from '@mantine/form';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconAlertCircle } from '@tabler/icons-react';
import { IconCheck } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { logFormDebug, logFormInfo, logFormError, startTiming, endTiming } from '@/utils/admin-debug';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client/index';

import { SetupNavigation } from './SetupNavigation';

export function FirstTimeSetup(): React.ReactElement {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [active, setActive] = useState(0);
    const [formKey] = useState(Date.now()); // Used to reset form
    const router = useRouter();
    const firstTimeSetupMutation = trpc.users.firstTimeSetup.useMutation();
    const form = useForm({
        initialValues: {
            userName: '',
            email: '',
            password: '',
            confirmPassword: ''
        },
        validate: {
            userName: (value: string) => value.length < 3 ? 'Username must be at least 3 characters' : null,
            email: (value: string) => /^\S+@\S+$/.test(value) ? null : 'Invalid email',
            password: (value: string) => {
                if (value.length < 8) return 'Password must be at least 8 characters';
                if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter';
                if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter';
                if (!/[0-9]/.test(value)) return 'Password must contain at least one number';
                return null;
            },
            confirmPassword: (value: string, values: {
                password: string;
            }) => value !== values.password ? 'Passwords do not match' : null
        }
    });
    // Check for URL query parameters that might contain response data
    useEffect(() => {
        if (router.query['success'] === 'true') {
            setActive(1);
            // Redirect to login after a delay
            const timer = setTimeout(() => {
                void router.push('/login');
            }, 3000);
            return () => clearTimeout(timer);
        }
        else if (router.query['error']) {
            setError(decodeURIComponent(router.query['error'] as string));
        }
        // Return a no-op cleanup function for other code paths
        return () => { };
    }, [router.query, router]);
    // Handle form submission with direct fetch API
    const handleSubmit = async (values: typeof form.values): Promise<void> => {
        logFormInfo('Direct API form submission started');
        startTiming('direct-form-submission');
        setIsLoading(true);
        setError(null);
        try {
            // Prepare the data for submission
            const data = {
                userName: values.userName,
                email: values.email,
                password: values.password,
                role: 'ADMIN' // First user is always admin
            };
            logFormDebug('Submitting form data via fetch API', {
                ...data,
                password: '******' // Mask password in logs
            });
            // Submit the form data via tRPC mutation
            const result = await firstTimeSetupMutation.mutateAsync({
                userName: data.userName,
                email: data.email,
                password: data.password
            });
            logFormInfo('Form submission response received', {
                success: result.success
            });
            // Handle the response
            if (result.success) {
                // Success - move to next step
                setActive(1);
                // Redirect to login after a delay
                setTimeout(() => {
                    void router.push('/login');
                }, 3000);
            }
            setIsLoading(false);
            endTiming('direct-form-submission');
        }
        catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            logFormError('tRPC form submission error', { error: errorMessage });
            logger.error('Setup error:', errorMessage, err);
            // Handle specific tRPC errors
            if (errorMessage.includes('Username already exists')) {
                form.setFieldError('userName', 'Username already exists');
            }
            else if (errorMessage.includes('Email already exists')) {
                form.setFieldError('email', 'Email already exists');
            }
            else if (errorMessage.includes('First-time setup can only be used when no users exist')) {
                setError('Setup has already been completed. Please login instead.');
            }
            else {
                setError(`An error occurred during setup: ${errorMessage}. Please try again.`);
            }
            setIsLoading(false);
            endTiming('direct-form-submission');
        }
    };
    return (<Container size="sm" py="xl">

      <Title order={2} ta="center" mb="lg">
        Welcome to Kaizoku
      </Title>
      
      <Divider my="md" label="Setup Process" labelPosition="center"/>
      
      {/* Setup-specific Navigation */}
      <SetupNavigation active={active}/>
      
      <Stepper active={active} orientation="horizontal" mb="xl">
        <Stepper.Step label="Create Admin" description="Set up your admin account">
          <Paper withBorder shadow="md" p={30} radius="md" mt="xl" pos="relative">
            <LoadingOverlay visible={isLoading}/>
            
            <Title order={3} mb="md">Create Admin Account</Title>
            <Text c="dimmed" mb="xl">
              This is the first time setup. Please create an admin account to get started.
            </Text>
            
            {error &&
            <Alert icon={<IconAlertCircle size={16}/>} title="Error" color="red" mb="md">
                {error}
              </Alert>}
            
            {/* Form with direct API submission */}
            <Box component="form" onSubmit={(e) => {
            e.preventDefault();
            if (form.validate().hasErrors)
                return;
            void handleSubmit(form.values);
        }} key={formKey}>

              <TextInput label="Username" name="userName" placeholder="admin" required mb="md" value={form.values['userName']} onChange={(e) => form.setFieldValue('userName', e.target.value)} error={form.errors['userName']} disabled={isLoading} autoComplete="username"/>

              
              <TextInput label="Email" name="email" placeholder="admin@example.com" required mb="md" value={form.values['email']} onChange={(e) => form.setFieldValue('email', e.target.value)} error={form.errors['email']} disabled={isLoading} autoComplete="email"/>

              
              <PasswordInput label="Password" name="password" placeholder="Your password" required mb="md" value={form.values['password']} onChange={(e) => form.setFieldValue('password', e.target.value)} error={form.errors['password']} disabled={isLoading} autoComplete="new-password"/>

              
              <PasswordInput label="Confirm Password" name="confirmPassword" placeholder="Confirm your password" required mb="xl" value={form.values['confirmPassword']} onChange={(e) => form.setFieldValue('confirmPassword', e.target.value)} error={form.errors['confirmPassword']} disabled={isLoading} autoComplete="new-password"/>

              
              <Button fullWidth type="submit" loading={isLoading}>

                Create Admin Account
              </Button>
              
              {/* JavaScript fallback message */}
              <noscript>
                <Text c="dimmed" size="sm" ta="center" mt="md">
                  JavaScript is required for this form. Please enable JavaScript or use the alternative setup page.
                </Text>
              </noscript>
            </Box>
          </Paper>
        </Stepper.Step>
        
        <Stepper.Step label="Complete" description="Setup complete">
          <Paper withBorder shadow="md" p={30} radius="md" mt="xl">
            <Alert icon={<IconCheck size={16}/>} title="Success" color="green" mb="md">

              Admin account created successfully ?? undefined
            </Alert>
            
            <Text ta="center" mb="md">
              You will be redirected to the login page in a few seconds...
            </Text>
            
            <Button fullWidth onClick={() => { void router.push('/login'); }}>

              Go to Login
            </Button>
          </Paper>
        </Stepper.Step>
      </Stepper>
    </Container>);
}
