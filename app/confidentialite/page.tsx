export default function Confidentialite() {
  return (
    <main style={{ padding: '80px 24px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
        Politique de Confidentialité
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 48 }}>Dernière mise à jour : mai 2026</p>

      <Section title="1. Responsable du traitement">
        <p>Le site backed.fr est édité à titre personnel. Pour toute question relative à vos données personnelles, vous pouvez contacter le responsable à l'adresse : <a href="mailto:hello.backedfr@gmail.com" style={{ color: 'var(--accent)' }}>hello.backedfr@gmail.com</a></p>
      </Section>

      <Section title="2. Données collectées">
        <p>Le site backed.fr ne requiert aucune inscription et ne collecte aucune donnée personnelle identifiable (nom, prénom, adresse email, etc.).</p>
        <p style={{ marginTop: 12 }}>Les seules données collectées sont des <strong>données de navigation anonymes</strong> :</p>
        <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Pages visitées</li>
          <li>Clics sur les codes promotionnels (suivi anonyme via notre propre système)</li>
          <li>Données techniques transmises par votre navigateur (type de navigateur, langue, résolution)</li>
        </ul>
        <p style={{ marginTop: 12 }}>Ces données sont utilisées uniquement à des fins statistiques internes et ne permettent pas d'identifier un utilisateur.</p>
      </Section>

      <Section title="3. Cookies">
        <p>Le site peut utiliser des cookies techniques strictement nécessaires au bon fonctionnement du service. Aucun cookie publicitaire ou de tracking tiers n'est déposé.</p>
      </Section>

      <Section title="4. Hébergement">
        <p>Le site est hébergé par <strong>Vercel Inc.</strong>, 340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis. Les données de navigation peuvent transiter par leurs serveurs dans le respect du RGPD.</p>
      </Section>

      <Section title="5. Base légale du traitement">
        <p>Le traitement des données de navigation anonymes repose sur l'intérêt légitime de l'éditeur à mesurer l'audience de son site et améliorer son service.</p>
      </Section>

      <Section title="6. Durée de conservation">
        <p>Les données de navigation anonymes sont conservées pour une durée maximale de 13 mois, conformément aux recommandations de la CNIL.</p>
      </Section>

      <Section title="7. Vos droits">
        <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
        <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Droit d'accès à vos données</li>
          <li>Droit de rectification</li>
          <li>Droit à l'effacement</li>
          <li>Droit d'opposition au traitement</li>
        </ul>
        <p style={{ marginTop: 12 }}>Pour exercer ces droits, contactez-nous à : <a href="mailto:hello.backedfr@gmail.com" style={{ color: 'var(--accent)' }}>hello.backedfr@gmail.com</a></p>
        <p style={{ marginTop: 12 }}>Vous disposez également du droit d'introduire une réclamation auprès de la <strong>CNIL</strong> (www.cnil.fr).</p>
      </Section>

      <Section title="8. Modifications">
        <p>Backed se réserve le droit de modifier la présente politique de confidentialité à tout moment. Les modifications entrent en vigueur dès leur publication sur cette page.</p>
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
