import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  updateStages(event) {
    const pipelineId = event.target.value
    const stageSelect = document.getElementById('chatwoot_push_deals_stage_id')
    
    if (!pipelineId) {
      stageSelect.innerHTML = '<option value="">Selecione uma Pipeline primeiro</option>'
      return
    }

    fetch(`/accounts/${this.getAccountId()}/pipelines/${pipelineId}.json`)
      .then(response => response.json())
      .then(data => {
        stageSelect.innerHTML = '<option value="">Selecione um Estágio</option>'
        data.stages.forEach(stage => {
          const option = document.createElement('option')
          option.value = stage.id
          option.text = stage.name
          stageSelect.appendChild(option)
        })
      })
  }

  getAccountId() {
    return window.location.pathname.split('/')[2]
  }
}
