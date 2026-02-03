"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {
    Home,
    User,
    Menu,
    X,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Key,
    Building2,
    Layers,
} from 'lucide-react';
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClient } from "@/lib/supabase/client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isUserDropdownOpen, setUserDropdownOpen] = useState(false);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const pathname = usePathname();
    const router = useRouter();


    const { user } = useGlobal();

    const handleLogout = async () => {
        try {
            const client = await createSPASassClient();
            await client.logout();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };
    const handleChangePassword = async () => {
        router.push('/app/user-settings')
    };

    const getInitials = (email: string) => {
        const parts = email.split('@')[0].split(/[._-]/);
        return parts.length > 1
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : parts[0].slice(0, 2).toUpperCase();
    };

    const productName = process.env.NEXT_PUBLIC_PRODUCTNAME;

    // Check if we're on an organization page
    const orgMatch = pathname.match(/^\/app\/org\/([^\/]+)/);
    const currentOrgSlug = orgMatch ? orgMatch[1] : null;

    // Build navigation based on user roles
    const navigation = [
        { name: 'Homepage', href: '/app', icon: Home },
    ];

    // Add Organizations and Approaches for system admins
    if (user?.roles?.isSystemAdmin) {
        navigation.push({ name: 'Organizations', href: '/app/admin/organizations', icon: Building2 });
        navigation.push({ name: 'Approaches', href: '/app/admin/approaches', icon: Layers });
    }

    // Add organization links
    if (user?.roles?.organizationMemberships && user.roles.organizationMemberships.length > 0) {
        user.roles.organizationMemberships.forEach((org) => {
            navigation.push({
                name: org.organizationSlug,
                href: `/app/org/${org.organizationSlug}`,
                icon: Building2,
            });
        });
    }

    // Always add User Settings
    navigation.push({ name: 'User Settings', href: '/app/user-settings', icon: User });

    // Build organization sub-navigation if on an org page
    const orgSubNavigation = currentOrgSlug ? [
        { name: 'Dashboard', href: `/app/org/${currentOrgSlug}` },
        { name: 'Questionnaires', href: `/app/org/${currentOrgSlug}/questionnaires` },
        { name: 'Analytics', href: `/app/org/${currentOrgSlug}/analytics` },
        { name: 'Participants', href: `/app/org/${currentOrgSlug}/participants` },
    ] : [];

    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    return (
        <div className="min-h-screen bg-gray-100">
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 bg-white shadow-lg transform transition-all duration-200 ease-in-out z-30
                ${isSidebarCollapsed ? 'w-16' : 'w-64'}
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>

                <div className="h-16 flex items-center justify-between px-4 border-b">
                    {!isSidebarCollapsed && (
                        <span className="text-xl font-semibold text-primary-600">{productName}</span>
                    )}
                    <button
                        onClick={toggleSidebar}
                        className="lg:hidden text-gray-500 hover:text-gray-700"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <button
                        onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
                        className="hidden lg:block text-gray-500 hover:text-gray-700 ml-auto"
                        title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {isSidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="mt-4 px-2 space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`group flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} px-2 py-2 text-sm font-medium rounded-md ${
                                    isActive
                                        ? 'bg-primary-50 text-primary-600'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                                title={isSidebarCollapsed ? item.name : ''}
                            >
                                <item.icon
                                    className={`${isSidebarCollapsed ? '' : 'mr-3'} h-5 w-5 ${
                                        isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                                    }`}
                                />
                                {!isSidebarCollapsed && item.name}
                            </Link>
                        );
                    })}
                </nav>

                {/* Organization Sub-Navigation */}
                {orgSubNavigation.length > 0 && !isSidebarCollapsed && (
                    <div className="mt-6 px-2">
                        <div className="px-2 mb-2">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Organization
                            </h3>
                        </div>
                        <nav className="space-y-1">
                            {orgSubNavigation.map((item) => {
                                // Check if current path starts with the item href (for nested routes)
                                // or matches exactly (for root routes like dashboard)
                                const isActive = item.href === `/app/org/${currentOrgSlug}`
                                    ? pathname === item.href
                                    : pathname.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                                            isActive
                                                ? 'bg-blue-50 text-blue-600'
                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                    >
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                )}

            </div>

            <div className={`transition-all duration-200 ${isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
                <div className="sticky top-0 z-10 flex items-center justify-between h-16 bg-white shadow-sm px-4">
                    <button
                        onClick={toggleSidebar}
                        className="lg:hidden text-gray-500 hover:text-gray-700"
                    >
                        <Menu className="h-6 w-6"/>
                    </button>

                    <div className="relative ml-auto">
                        <button
                            onClick={() => setUserDropdownOpen(!isUserDropdownOpen)}
                            className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900"
                        >
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-primary-700 font-medium">
                                    {user ? getInitials(user.email) : '??'}
                                </span>
                            </div>
                            <span>{user?.email || 'Loading...'}</span>
                            <ChevronDown className="h-4 w-4"/>
                        </button>

                        {isUserDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border">
                                <div className="p-2 border-b border-gray-100">
                                    <p className="text-xs text-gray-500">Signed in as</p>
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {user?.email}
                                    </p>
                                </div>
                                <div className="py-1">
                                    <button
                                        onClick={() => {
                                            setUserDropdownOpen(false);
                                            handleChangePassword()
                                        }}
                                        className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        <Key className="mr-3 h-4 w-4 text-gray-400"/>
                                        Change Password
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleLogout();
                                            setUserDropdownOpen(false);
                                        }}
                                        className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                    >
                                        <LogOut className="mr-3 h-4 w-4 text-red-400"/>
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <main className="p-4">
                    {children}
                </main>
            </div>
        </div>
    );
}