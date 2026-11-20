import { AuthScreen } from "@/ui/auth-screen";
export const dynamic = "force-dynamic";
export default function Recover() {
  return <AuthScreen initial="forgot" />;
}
