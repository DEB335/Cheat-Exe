import { redirect } from "next/navigation";

/** Middleware sends signed-out visitors to /login before this renders. */
export default function Home() {
  redirect("/dashboard");
}
