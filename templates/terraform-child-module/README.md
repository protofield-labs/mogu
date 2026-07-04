# Terraform Child Module Template

Copy this directory when creating a flat project child module, such as
`terraform/modules/vpc` or `terraform/modules/ecs_service`.

After copying, rename `*.tf.tmpl` files to `*.tf` and replace placeholder values.

Child modules own component resources and output the IDs, ARNs, and names
that root modules need for composition. See
`.agents/skills/terraform-project-guidelines/references/module-design.md`
for the module design rules.
