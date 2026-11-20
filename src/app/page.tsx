import { currentUser } from "@/server/auth";
import { Workspace } from "@/ui/workspace";
import { AuthScreen } from "@/ui/auth-screen";

export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await currentUser();
  return user ? <Workspace email={user.email} /> : <AuthScreen />;
}
