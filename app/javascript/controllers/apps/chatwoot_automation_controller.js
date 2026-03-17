import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["pipelineSelect", "stageSelect"]
  static values = { 
    accountId: String,
    initialStageId: String
  }

  connect() {
    console.log("Chatwoot Automation Controller connected")
    if (this.hasPipelineSelectTarget && this.pipelineSelectTarget.value) {
      this.updateStages()
    }
  }

  updateStages() {
    const pipelineId = this.pipelineSelectTarget.value
    if (!pipelineId) {
      this.stageSelectTarget.innerHTML = '<option value="">Selecione uma Pipeline primeiro</option>'
      return
    }

    const accountId = this.accountIdValue || this.getAccountId()
    
    fetch(`/accounts/${accountId}/pipelines/${pipelineId}.json`)
      .then(response => response.json())
      .then(data => {
        const currentStageId = this.initialStageIdValue || this.stageSelectTarget.value
        this.stageSelectTarget.innerHTML = '<option value="">Selecione um Estágio</option>'
        
        data.stages.forEach(stage => {
          const option = document.createElement('option')
          option.value = stage.id
          option.text = stage.name
          if (stage.id.toString() === currentStageId.toString()) {
            option.selected = true
          }
          this.stageSelectTarget.appendChild(option)
        })
      })
      .catch(error => console.error("Error fetching stages:", error))
  }

  getAccountId() {
    const pathParts = window.location.pathname.split('/')
    const index = pathParts.indexOf('accounts')
    return index !== -1 ? pathParts[index + 1] : null
  }
}
