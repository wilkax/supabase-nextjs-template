'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createSPASassClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { CheckCircle, Key } from 'lucide-react';

export default function ResetPasswordPage() {
    const t = useTranslations('auth');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    // Extract tokens from URL hash and establish session
    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                // Get hash fragment from URL
                const hashFragment = window.location.hash.substring(1);
                if (!hashFragment) {
                    setError(t('invalidOrExpiredLink'));
                    return;
                }

                // Parse hash parameters
                const params = new URLSearchParams(hashFragment);
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');
                const type = params.get('type');

                // Check if we have the required tokens
                if (!accessToken || !refreshToken) {
                    setError(t('invalidOrExpiredLink'));
                    return;
                }

                // Establish session with the tokens
                const supabase = await createSPASassClient();
                const { data, error: sessionError } = await supabase.getSupabaseClient().auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });

                if (sessionError || !data.session) {
                    setError(t('invalidOrExpiredLink'));
                    return;
                }

                // Verify the user is authenticated
                const { data: { user }, error: userError } = await supabase.getSupabaseClient().auth.getUser();

                if (userError || !user) {
                    setError(t('invalidOrExpiredLink'));
                }
            } catch {
                setError(t('failedToVerifySession'));
            }
        };

        handleAuthCallback();
    }, [t]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError(t('passwordsDoNotMatch'));
            return;
        }

        if (newPassword.length < 6) {
            setError(t('passwordMinLength'));
            return;
        }

        setLoading(true);

        try {
            const supabase = await createSPASassClient();
            const { error } = await supabase.getSupabaseClient().auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            setSuccess(true);
            setTimeout(() => {
                router.push('/app');
            }, 3000);
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError(t('failedToResetPassword'));
            }
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        <CheckCircle className="h-16 w-16 text-green-500" />
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {t('passwordSetSuccessfully')}
                    </h2>

                    <p className="text-gray-600 mb-8">
                        {t('passwordSetSuccessfullyDescription')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center mb-4">
                    <Key className="h-12 w-12 text-primary-600" />
                </div>
                <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
                    {t('setYourPassword')}
                </h2>
            </div>

            {error && (
                <div className="mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                        {t('newPassword')}
                    </label>
                    <div className="mt-1">
                        <input
                            id="new-password"
                            name="new-password"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                        {t('confirmNewPassword')}
                    </label>
                    <div className="mt-1">
                        <input
                            id="confirm-password"
                            name="confirm-password"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                        />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                        {t('passwordMinLength')}
                    </p>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full justify-center rounded-md border border-transparent bg-primary-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {loading ? t('settingPassword') : t('setPassword')}
                    </button>
                </div>
            </form>
        </div>
    );
}