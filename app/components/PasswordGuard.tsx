"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PasswordGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    const savedDate = localStorage.getItem("hyun0001_access_date");

    if (savedDate === today) {
      setAllowed(true);
    } else {
      router.push("/");
    }
  }, [router]);

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}