"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { Session } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { produce } from "immer";
import { apiGet, apiPatch } from "./api";
import { useParams } from "next/navigation";
import { Profile, Project, BurnConfig } from "@/utils/types";
import { isMobile } from "react-device-detect";

interface SessionContextType {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  reloadProfile: () => Promise<void>;

  updateProfile: (fn: (draft: Profile) => void) => void;

  showSidebar: boolean;
  toggleSidebar: () => void;
}

const SessionContext = createContext<SessionContextType>({
  session: null,
  profile: null,
  isLoading: true,
  reloadProfile: () => Promise.reject(),
  updateProfile: () => {},

  showSidebar: false,
  toggleSidebar: () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isSignedInRef = useRef(false);
  const [showSidebar, setShowSidebar] = useState(isMobile ? false : true);

  const onAuthStateChange = useCallback(
    async (_event: string, session: Session | null) => {
      if (
        isSignedInRef.current &&
        (_event === "SIGNED_IN" || _event === "TOKEN_REFRESHED")
      ) {
        return;
      }

      if (_event === "SIGNED_IN") {
        setIsLoading(true);
        try {
          const profile = await apiGet("/profile");
          setProfile(profile);
        } finally {
          setIsLoading(false);
          isSignedInRef.current = true;
        }
      } else if (_event === "SIGNED_OUT") {
        setProfile(null);
        isSignedInRef.current = false;
      }
      setSession(session);
    },
    [],
  );

  useEffect(() => {
    (async () => {
      try {
        supabase!.auth.onAuthStateChange(onAuthStateChange);

        setIsLoading(true);
        const {
          data: { session },
        } = await supabase!.auth.getSession();
        const profile = await apiGet("/profile", undefined, {
          hideToast: true,
        }); // throws if not signed in, which is fine

        setSession(session);
        setProfile(profile);
        isSignedInRef.current = true;
      } catch (e) {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const reloadProfile = async () => {
    setIsLoading(true);
    try {
      const profile = await apiGet("/profile");
      setProfile(profile);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = (fn: (draft: Profile) => void) => {
    const newProfile = produce(profile, fn);
    setProfile(newProfile);
    return newProfile;
  };

  return (
    <SessionContext.Provider
      value={{
        session,
        profile,
        isLoading,
        reloadProfile,

        updateProfile,

        showSidebar,
        toggleSidebar: () => setShowSidebar(!showSidebar),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);

export const useProject = () => {
  const { slug: currentSlug } = useParams();
  const session = useSession();
  const { profile, updateProfile } = session;
  const project = profile?.projects.find((p) => p.slug === currentSlug);

  const updateProject = (fn: (draft: Project) => void) => {
    if (!project) return;
    const newProject = produce(project, fn);
    updateProfile((draft) => {
      draft.projects = draft.projects.map((p) =>
        p.slug === currentSlug ? newProject : p,
      );
    });
  };

  const updateProjectSimple = (newProject: Partial<Project>) => {
    updateProject((draft) => {
      Object.assign(draft, newProject);
    });
  };

  const updateBurnConfig = async (newConfig: Partial<BurnConfig>) => {
    if (!project) return;

    await apiPatch(`/burn/${project.slug}/admin/config`, newConfig);

    updateProject((draft) => {
      Object.assign(draft.burn_config, newConfig);
    });
  };

  return {
    ...session,
    project,
    updateProject,
    updateProjectSimple,
    updateBurnConfig,
  };
};
