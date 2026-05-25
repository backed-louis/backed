export default function CGU() {
  return (
    <main style={{ padding: '80px 24px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
        Conditions Générales d'Utilisation
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 48 }}>Dernière mise à jour : mai 2026</p>

      <Section title="1. Présentation du site">
        <p>Backed (accessible à l'adresse <strong>backed.fr</strong>) est un service de référencement de codes promotionnels associés à des créateurs de contenu. Le site est édité à titre personnel par son fondateur, joignable à l'adresse <a href="mailto:hello.backedfr@gmail.com" style={{ color: 'var(--accent)' }}>hello.backedfr@gmail.com</a>.</p>
      </Section>

      <Section title="2. Acceptation des CGU">
        <p>L'accès et l'utilisation du site backed.fr impliquent l'acceptation pleine et entière des présentes Conditions Générales d'Utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser le site.</p>
      </Section>

      <Section title="3. Accès au service">
        <p>Le site est accessible gratuitement et sans création de compte. Il permet à tout visiteur de consulter des codes promotionnels référencés par des créateurs de contenu partenaires.</p>
        <p style={{ marginTop: 12 }}>Backed se réserve le droit de modifier, suspendre ou interrompre l'accès au site à tout moment, sans préavis.</p>
      </Section>

      <Section title="4. Propriété intellectuelle">
        <p>L'ensemble des contenus présents sur backed.fr (textes, logos, structure, codes sources) sont la propriété exclusive de Backed, sauf mention contraire. Toute reproduction, même partielle, est interdite sans autorisation préalable.</p>
        <p style={{ marginTop: 12 }}>Les codes promotionnels référencés appartiennent à leurs créateurs respectifs. Backed n'est en aucun cas responsable de leur validité, de leur durée ou de leur disponibilité.</p>
      </Section>

      <Section title="5. Responsabilité">
        <p>Backed s'efforce de maintenir les informations à jour mais ne garantit pas l'exactitude, la complétude ou l'actualité des codes promotionnels publiés. L'utilisation de ces codes se fait sous la seule responsabilité de l'utilisateur.</p>
        <p style={{ marginTop: 12 }}>Backed ne peut être tenu responsable de toute perte ou dommage résultant de l'utilisation ou de l'impossibilité d'utiliser le site ou les codes promotionnels référencés.</p>
      </Section>

      <Section title="6. Liens externes">
        <p>Le site peut contenir des liens vers des sites tiers. Backed n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.</p>
      </Section>

      <Section title="7. Droit applicable">
        <p>Les présentes CGU sont soumises au droit français. Tout litige relatif à leur interprétation ou exécution relève de la compétence exclusive des tribunaux français.</p>
      </Section>

      <Section title="8. Contact">
        <p>Pour toute question relative aux présentes CGU, vous pouvez contacter Backed à l'adresse suivante : <a href="mailto:hello.backedfr@gmail.com" style={{ color: 'var(--accent)' }}>hello.backedfr@gmail.com</a></p>
      </Section>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontFamily: 'var(--font-syne)', fontSize: 18, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.01em' }}>{title}</h2>
      <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.8 }}>{children}</div>
    </section>
  )
}
