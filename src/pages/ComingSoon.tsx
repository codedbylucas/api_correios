import { Construction } from 'lucide-react';

export default function ComingSoon({ title = 'Em breve' }: { title?: string }) {
  return (
    <div className="px-6 py-10 lg:px-10">
      <div className="max-w-2xl bg-[#131316] border border-white/10 rounded-2xl p-8">
        <Construction className="w-8 h-8 text-[#E7B24A] mb-4" />
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-white/40 mt-2">Esta seção já está reservada no painel e será conectada ao fluxo correspondente.</p>
      </div>
    </div>
  );
}
