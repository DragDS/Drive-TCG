<div id="helpSection" class="section">
  
  <h2>Help & Information</h2>
  <p>This page provides reference information, workflow tips, and backup tools.</p>

  <!-- LOCAL BACKUP & TOOLS MOVED HERE -->
  <div class="backup-box">
    <h3>LOCAL BACKUP &amp; TOOLS <span class="pill">SAFE EDITING</span></h3>
    <button class="btn green" id="autoLoadBtn">AUTO-LOAD FROM JSON WHEN POSSIBLE</button>
    <p>The admin will try to load <strong>drive-card.json</strong> &amp;
      <strong>drive-precons.json</strong>, and fall back to <strong>localStorage</strong> backups if needed.</p>

    <div class="suggestion-box">
      <h4>Workflow suggestion:</h4>
      <ol>
        <li>Open this admin and let it load <strong>drive-card.json</strong> and <strong>drive-precons.json</strong>.</li>
        <li>Use <strong>Single</strong> and <strong>Bulk</strong> tabs to edit or create cards.</li>
        <li>Check precons under <strong>Precons</strong> to verify deck contents are correct.</li>
        <li>Click <strong>Export Card JSON</strong> and <strong>Export Precon JSON</strong> to download updated files.</li>
        <li>Replace the JSON files in your repo with the exported ones and commit.</li>
      </ol>
    </div>
  </div>

</div>
