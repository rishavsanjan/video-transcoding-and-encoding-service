import React from 'react'

interface NavItem {
    icon: string;
    label: string;
    active?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
    { icon: "dashboard", label: "Dashboard" },
    { icon: "settings_input_component", label: "Encode", active: true },
    { icon: "running_with_errors", label: "Jobs" },
    { icon: "history", label: "History" },
    { icon: "settings", label: "Settings" },
];

const SECONDARY_NAV: NavItem[] = [
    { icon: "help", label: "Support" },
    { icon: "logout", label: "Sign Out" },
];

const Sidebar = () => {
    return (
        <nav className="w-[240px] h-screen fixed left-0 top-0 bg-surface border-r border-outline-variant flex flex-col py-layout-margin z-50">
            <div className="px-layout-margin mb-8">
                <h1 className="font-headline-md text-headline-md font-black tracking-tighter text-primary">
                    V-CODEC
                </h1>
                <p className="font-label-caps text-label-caps text-on-surface-variant mt-1">
                    Pro Engine v2.4
                </p>
            </div>

            <button
                type="button"
                className="mx-4 mb-6 bg-primary-container text-on-primary-container font-headline-sm text-headline-sm rounded py-2 hover:bg-primary transition-colors"
            >
                New Job
            </button>

            <div className="flex flex-col flex-1">
                {PRIMARY_NAV.map((item) => (
                    <a
                        key={item.label}
                        href="#"
                        className={
                            item.active
                                ? "flex items-center gap-3 px-4 py-3 text-primary border-r-2 border-primary bg-surface-container-lowest cursor-pointer active:scale-95 duration-150"
                                : "flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer active:scale-95 duration-150"
                        }
                    >
                        <span className="material-symbols-outlined">{item.icon}</span>
                        <span className="font-headline-sm text-headline-sm">{item.label}</span>
                    </a>
                ))}
            </div>

            <div className="flex flex-col mt-auto pt-4 border-t border-outline-variant mx-4">
                {SECONDARY_NAV.map((item) => (
                    <a
                        key={item.label}
                        href="#"
                        className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer active:scale-95 duration-150"
                    >
                        <span className="material-symbols-outlined">{item.icon}</span>
                        <span className="font-headline-sm text-headline-sm">{item.label}</span>
                    </a>
                ))}
            </div>
        </nav>
    )
}

export default Sidebar