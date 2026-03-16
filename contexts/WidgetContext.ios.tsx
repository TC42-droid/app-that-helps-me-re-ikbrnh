import * as React from "react";
import { createContext, useCallback, useContext } from "react";
import { ExtensionStorage } from "@bacons/apple-targets";

type WidgetContextType = {
  refreshWidget: () => void;
};

const WidgetContext = createContext<WidgetContextType | null>(null);

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    try {
      ExtensionStorage.reloadWidget();
    } catch {
      // Not available in Expo Go
    }
  }, []);

  const refreshWidget = useCallback(() => {
    try {
      ExtensionStorage.reloadWidget();
    } catch {
      // Not available in Expo Go
    }
  }, []);

  return (
    <WidgetContext.Provider value={{ refreshWidget }}>
      {children}
    </WidgetContext.Provider>
  );
}

export const useWidget = () => {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("useWidget must be used within a WidgetProvider");
  }
  return context;
};
