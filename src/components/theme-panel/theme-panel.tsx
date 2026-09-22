"use client";

import { useState, useEffect } from "react";
import { useAppSettings } from "@/config/app-settings";

export default function ThemePanel() {
  const { settings, updateSettings } = useAppSettings();
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState("");
  const [theme, setTheme] = useState("");

  const toggleAppThemePanel = () => {
    setActive((prev) => (prev === 0 ? 1 : 0));
    if (typeof window !== "undefined") {
      localStorage.appThemePanelActive = active === 0 ? "true" : "false";
    }
  };

  const setAppTheme = (theme: string) => {
    document.body.classList.forEach((cls) => {
      if (cls.startsWith("theme-") && cls !== theme) {
        document.body.classList.remove(cls);
      }
    });

    if (theme) {
      document.body.classList.add("theme-" + theme);
    }
    if (typeof window !== "undefined") {
      localStorage.appTheme = theme;
    }
    setTheme(theme);
    document.dispatchEvent(new Event("theme-reload"));
  };

  const setAppMode = (mode: string) => {
    document.documentElement.setAttribute("data-bs-theme", mode);
    if (typeof window !== "undefined") {
      localStorage.appMode = mode;
    }
    setMode(mode);
    document.dispatchEvent(new Event("theme-reload"));
  };

  const handleDarkModeCheckboxChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const isChecked = event.target.checked;
    setMode(isChecked ? "dark" : "light");
    setAppMode(isChecked ? "dark" : "light");
  };

  const themeList = [
    "red",
    "pink",
    "orange",
    "yellow",
    "lime",
    "green",
    "teal",
    "cyan",
    "blue",
    "purple",
    "indigo",
    "dark",
  ];

  const handleToggle = (setting: string, value: boolean) => {
    const newSettings = { ...settings, [setting]: value };

    if (setting === "appHeaderFixed" && !value) {
      newSettings["appSidebarFixed"] = false;
    }

    if (setting === "appSidebarFixed" && value) {
      newSettings["appHeaderFixed"] = true;
    }

    updateSettings(newSettings);
  };

  const toggleTheme = (e: React.MouseEvent, theme: string) => {
    e.preventDefault();
    updateSettings({ appTheme: theme });
    setAppTheme(theme);
    if (typeof window !== "undefined") {
      localStorage.setItem("appTheme", theme);
    }
  };

  const getSetting = (key: string): boolean =>
    !!settings?.[key as keyof typeof settings];

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage) {
      setActive(localStorage.appThemePanelActive === "true" ? 1 : 0);
      setAppMode(localStorage.appMode || "");
      setAppTheme(localStorage.appTheme || "teal");
    }
    setTimeout(() => {
      if (typeof window !== "undefined" && window.bootstrap) {
        const tooltipElements = document.querySelectorAll(
          '[data-bs-toggle="tooltip"]'
        );
        tooltipElements.forEach((tooltipElement) => {
          new window.bootstrap.Tooltip(tooltipElement);
        });
      }
    }, 100);
  }, []);

  return (
    <div className={`theme-panel ${active ? "active" : ""}`}>
      <a
        href="#0"
        onClick={(e) => {
          e.preventDefault();
          toggleAppThemePanel();
        }}
        className="theme-collapse-btn"
      >
        <i className="fa fa-cog"></i>
      </a>
      <div
        className="theme-panel-content"
        data-scrollbar="true"
        data-height="100%"
      >
        <h5>App Settings</h5>

        <div className="theme-list">
          {themeList.map((themeItem, i) => (
            <div
              key={i}
              className={`theme-list-item ${
                themeItem === theme ? "active" : ""
              }`}
            >
              <a
                href="#0"
                data-bs-toggle="tooltip"
                data-bs-title={
                  themeItem.charAt(0).toUpperCase() + themeItem.slice(1)
                }
                onClick={(e) => toggleTheme(e, themeItem)}
                className={`theme-list-link bg-${themeItem}`}
              >
                &nbsp;
              </a>
            </div>
          ))}
        </div>

        <div className="theme-panel-divider"></div>

        <div className="row mt-10px">
          <div className="col-8 control-label text-dark fw-bold">
            <div className="d-flex">
              Dark Mode
            </div>
            <div className="lh-14">
              <small className="text-dark opacity-50">
                Reduce glare for easier viewing.
              </small>
            </div>
          </div>
          <div className="col-4 d-flex">
            <div className="form-check form-switch ms-auto mb-0">
              <input
                type="checkbox"
                className="form-check-input"
                name="app-theme-dark-mode"
                onChange={handleDarkModeCheckboxChange}
                id="appThemeDarkMode"
                checked={mode === "dark"}
                value="1"
              />
              <label
                className="form-check-label"
                htmlFor="appThemeDarkMode"
              ></label>
            </div>
          </div>
        </div>

        <div className="theme-panel-divider"></div>

        <div className="theme-options">
          {[
            "HeaderFixed",
            "HeaderInverse",
            "SidebarFixed",
            "SidebarGrid",
            "GradientEnabled",
          ].map((option, index) => (
            <div
              key={index}
              className="row mt-10px align-items-center"
            >
              <div className="col-8 control-label text-dark fw-bold">
                {option.replace(/([A-Z])/g, " $1").trim()}
              </div>
              <div className="col-4 d-flex">
                <div className="form-check form-switch ms-auto mb-0">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`app${option}`}
                    checked={getSetting(`app${option}`)}
                    onChange={(e) =>
                      handleToggle(`app${option}`, e.target.checked)
                    }
                  />
                  <label
                    className="form-check-label"
                    htmlFor={`app${option}`}
                  ></label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
