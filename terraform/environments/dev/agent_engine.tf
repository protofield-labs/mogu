# Vertex AI Agent Engine (#43). Requires enable_external_apis (#47).
locals {
  agent_engine_enabled = var.enable_external_apis && var.enable_agent_engine

  # ADK AdkApp class methods (inline source deploy). Shared by both engines.
  adk_class_methods = [
    {
      name        = "async_create_session"
      api_mode    = "async"
      description = "Create a new session"
      parameters  = { type = "object", required = [], properties = {} }
    },
    {
      name        = "async_stream_query"
      api_mode    = "async_stream"
      description = "Stream responses from the agent"
      parameters  = { type = "object", required = [], properties = {} }
    },
  ]
}

data "archive_file" "orchestrator_agent" {
  count = local.agent_engine_enabled ? 1 : 0

  type        = "tar.gz"
  source_dir  = "${path.module}/../../../agents/mogu"
  output_path = "${path.module}/.agent-orchestrator.tar.gz"
  excludes    = ["__pycache__", "**/__pycache__"]
}

data "archive_file" "maps_grounding_agent" {
  count = local.agent_engine_enabled ? 1 : 0

  type        = "tar.gz"
  source_dir  = "${path.module}/../../../agents/mogu_maps"
  output_path = "${path.module}/.agent-maps-grounding.tar.gz"
  excludes    = ["__pycache__", "**/__pycache__"]
}

resource "google_vertex_ai_reasoning_engine" "orchestrator" {
  count = local.agent_engine_enabled ? 1 : 0

  display_name = "${var.environment}-mogu-orchestrator"
  description  = "mogu orchestrator (Sessions + Memory Bank host, #43)"
  region       = var.region
  project      = var.project_id

  spec {
    agent_framework = "google-adk"
    class_methods   = jsonencode(local.adk_class_methods)

    source_code_spec {
      inline_source {
        source_archive = filebase64(data.archive_file.orchestrator_agent[0].output_path)
      }

      python_spec {
        entrypoint_module = "agent"
        entrypoint_object = "adk_app"
        requirements_file = "requirements.txt"
        version           = "3.12"
      }
    }
  }

  depends_on = [google_project_service.services]
}

# Maps Grounding is a separate engine (built-in tool coexistence constraint, features 4-2).
resource "google_vertex_ai_reasoning_engine" "maps_grounding" {
  count = local.agent_engine_enabled ? 1 : 0

  display_name = "${var.environment}-mogu-maps-grounding"
  description  = "Maps Grounding agent (separate from orchestrator, #43)"
  region       = var.region
  project      = var.project_id

  spec {
    agent_framework = "google-adk"
    class_methods   = jsonencode(local.adk_class_methods)

    source_code_spec {
      inline_source {
        source_archive = filebase64(data.archive_file.maps_grounding_agent[0].output_path)
      }

      python_spec {
        entrypoint_module = "agent"
        entrypoint_object = "adk_app"
        requirements_file = "requirements.txt"
        version           = "3.12"
      }
    }
  }

  depends_on = [google_project_service.services]
}
