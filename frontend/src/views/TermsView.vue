<template>
  <main class="legal-page">
    <div class="parallax-bg"></div>
    <div class="legal-container">
      <header class="legal-header">
        <AppIcon name="file" :size="48" class="header-icon" />
        <h1>Terms of Service</h1>
        <p class="last-updated">Last updated: April 2026</p>
      </header>

      <section class="legal-content">
        
        <div class="policy-block">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using BlackHole, you agree to be bound by these Terms of Service. If you do not agree with any provision, you must discontinue use of the service.
          </p>
        </div>

        <div class="policy-block">
          <h2>2. Eligibility and Account Responsibility</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must provide accurate information and keep your profile details reasonably up to date.
          </p>
        </div>

        <div class="policy-block">
          <h2>3. Code of Conduct and Prohibited Behavior</h2>
          <p>The following actions are strictly prohibited:</p>
          <ul>
            <li>Cheating, scripting, automation, bot usage, or unauthorized third-party tools.</li>
            <li>Exploitation of bugs, vulnerabilities, or unintended game mechanics.</li>
            <li>Harassment, hate speech, abusive language, impersonation, or spam.</li>
            <li>Account sharing, account farming, or coordinated manipulation of ranking systems.</li>
            <li>Any action that disrupts gameplay integrity, platform security, or user experience.</li>
          </ul>
        </div>

        <div class="policy-block">
          <h2>4. Multiplayer Rules and Match Integrity</h2>
          <p>
            Multiplayer sessions are managed by server-authoritative state synchronization. Match outcomes, progression metrics, and ranking data are based on validated server events. Attempts to tamper with synchronization, latency, or client state are treated as abuse.
          </p>
        </div>

        <div class="policy-block">
          <h2>5. Matchmaking, Connectivity, and Session Handling</h2>
          <p>
            Matchmaking may place users into shared rooms based on game settings and availability. We do not guarantee immediate queue times. In case of disconnection, network failure, or client crash, matches may continue, end, or be resolved according to server rules and anti-abuse policies.
          </p>
        </div>

        <div class="policy-block">
          <h2>6. Virtual Economy, Rewards, and Progression</h2>
          <p>
            In-game currencies, scores, badges, achievements, and progression rewards are virtual items with no cash value unless explicitly stated otherwise. They are non-transferable, non-refundable, and may be adjusted, revoked, or reset in case of abuse, exploits, or balancing updates.
          </p>
        </div>

        <div class="policy-block">
          <h2>7. Suspension and Termination</h2>
          <p>
            We reserve the right to suspend, restrict, or terminate access to any account that violates these Terms, threatens platform security, or harms the community. Enforcement may be immediate and may include data or ranking adjustments where necessary.
          </p>
        </div>

        <div class="policy-block">
          <h2>8. Intellectual Property</h2>
          <p>
            All platform content, branding, game assets, and associated materials are protected by applicable intellectual property laws. You may not copy, redistribute, reverse engineer, or commercially exploit the service except where explicitly permitted by law or license.
          </p>
        </div>

        <div class="policy-block">
          <h2>9. Warranties and Liability</h2>
          <p>
            The service is provided on an "as is" and "as available" basis. To the extent permitted by law, we disclaim warranties of uninterrupted availability and fitness for a particular purpose. Our liability is limited to direct damages as required by applicable law.
          </p>
        </div>

        <div class="policy-block">
          <h2>10. Governing Law and Changes</h2>
          <p>
            These Terms are governed by applicable law in the relevant jurisdiction of service operation, subject to mandatory consumer protections where applicable. We may update these Terms periodically; continued use after updates constitutes acceptance of the revised Terms.
          </p>
        </div>
      </section>

      <footer class="legal-actions">
        <button class="back-btn" @click="$router.push('/menu')">
          BACK TO MENU
        </button>
      </footer>
    </div>
  </main>
</template>

<script setup>
import AppIcon from '@/components/ui/AppIcon.vue'
</script>

<style scoped>
.legal-page {
  min-height: 100vh;
  background: #000000;
  color: #e2e8f0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 20px;
  font-family: 'Orbitron', 'Inter', sans-serif;
  position: relative;
  overflow-y: auto;
}

.parallax-bg {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at center, #111111 0%, #000000 100%);
  z-index: 0;
}

.legal-container {
  position: relative;
  z-index: 1;
  max-width: 850px;
  width: 100%;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(150, 150, 150, 0.4);
  border-radius: 16px;
  padding: 50px;
  box-shadow: 0 0 50px rgba(100, 100, 100, 0.15), inset 0 0 20px rgba(200, 200, 200, 0.1);
}

.legal-header {
  text-align: center;
  margin-bottom: 40px;
  border-bottom: 1px solid rgba(150, 150, 150, 0.3);
  padding-bottom: 20px;
}

.header-icon {
  color: #cccccc;
  margin-bottom: 15px;
  filter: drop-shadow(0 0 15px rgba(200, 200, 200, 0.8));
}

h1 {
  font-size: 2.5rem;
  letter-spacing: 3px;
  margin: 0;
  color: #ffffff;
  text-transform: uppercase;
  text-shadow: 0 0 10px rgba(200, 200, 200, 0.6), 0 0 20px rgba(150, 150, 150, 0.5);
}

.last-updated {
  color: rgba(226, 232, 240, 0.5);
  font-size: 0.9rem;
  margin-top: 10px;
}

.legal-content {
  display: grid;
  gap: 30px;
}

.policy-block h2 {
  color: #eeeeee;
  font-size: 1.3rem;
  letter-spacing: 1.5px;
  margin-bottom: 15px;
  text-transform: uppercase;
  text-shadow: 0 0 8px rgba(200, 200, 200, 0.5);
}

.policy-block p, .policy-block ul {
  line-height: 1.7;
  color: #cbd5e1;
  font-family: 'Inter', sans-serif;
  font-size: 1rem;
}

.policy-block ul {
  padding-left: 20px;
  margin-top: 10px;
}

.policy-block li {
  margin-bottom: 8px;
}

.policy-block strong {
  color: #f8fafc;
  text-shadow: 0 0 5px rgba(255,255,255,0.3);
}

.code-example {
  background: rgba(20, 20, 20, 0.6);
  border: 1px solid rgba(150, 150, 150, 0.3);
  border-radius: 8px;
  padding: 15px 20px;
  margin: 15px 0;
  font-family: monospace;
}

.example-title {
  color: #94a3b8 !important;
  font-size: 0.85rem !important;
  margin-bottom: 10px !important;
  text-transform: uppercase;
  letter-spacing: 1px;
}

code {
  color: #dddddd;
  font-size: 1.1rem;
  line-height: 1.5;
  display: block;
  white-space: pre-wrap;
}

.legal-actions {
  margin-top: 50px;
  text-align: center;
}

.back-btn {
  background: linear-gradient(135deg, rgba(150, 150, 150, 0.15), rgba(100, 100, 100, 0.15));
  border: 1px solid #a3a3a3;
  color: #ffffff;
  padding: 14px 36px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Orbitron', sans-serif;
  font-weight: 700;
  letter-spacing: 2px;
  box-shadow: 0 0 15px rgba(150, 150, 150, 0.3);
}

.back-btn:hover {
  background: linear-gradient(135deg, rgba(150, 150, 150, 0.4), rgba(100, 100, 100, 0.4));
  box-shadow: 0 0 25px rgba(150, 150, 150, 0.6), 0 0 15px rgba(200, 200, 200, 0.6);
  transform: translateY(-2px);
}

@media (max-width: 600px) {
  .legal-container {
    padding: 30px 20px;
  }
  h1 {
    font-size: 1.8rem;
  }
  .code-example {
    font-size: 0.9rem;
  }
}
</style>
