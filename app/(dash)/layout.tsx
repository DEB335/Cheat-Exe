import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

import { Shell } from "./shell";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <Shell user={user}>{children}</Shell>;
}
