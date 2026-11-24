import ScanApp from "./ScanApp";

export const metadata = { title: "Escanear prato — Visatto" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ScanApp token={token} />;
}
