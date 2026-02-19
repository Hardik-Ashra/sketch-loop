import { redirect } from "next/navigation";

export default function Home() {
  redirect("https://sketch-loop.vercel.app/auth/sign-in");
}
