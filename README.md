# mogu

Next.js アプリと Google Cloud インフラ（Terraform）を 1 つのリポジトリで管理する
モノレポです。AI Agent と人間が安全に共同作業できるよう、ルール・スクリプト・
スキルを整備しています。

## アーキテクチャ

```mermaid
flowchart LR
    subgraph Client
        U["ブラウザ"]
    end

    subgraph GoogleCloud["Google Cloud (asia-northeast1)"]
        CR["Cloud Run<br/>Next.js (App Router)"]
        SQL[("Cloud SQL<br/>PostgreSQL 18<br/>private IP + RLS")]
        SM["Secret Manager"]
        FB["Firebase Auth<br/>Email / Google"]
        AR["Artifact Registry"]
        MON["Cloud Monitoring<br/>+ Budget Alerts"]
    end

    subgraph CI["GitHub Actions"]
        GA["Deploy / Terraform Plan<br/>(Workload Identity Federation)"]
    end

    U -- HTTPS --> CR
    U -- sign in --> FB
    CR -- "ID token 検証 (Admin SDK)" --> FB
    CR -- "Direct VPC egress" --> SQL
    CR --> SM
    GA -- push image --> AR
    GA -- deploy --> CR
    MON -- alert --> SLK["Slack"]
```

- **認証**: Firebase Authentication（Email/Password + Google）。API は Bearer
  トークン検証、DB は PostgreSQL RLS で自分の行のみアクセス可能
- **CI/CD**: GitHub Actions + Workload Identity Federation（SA キーレス）。
  `main` への push で自動デプロイ、PR で Terraform plan を自動レビュー
- **コスト**: Cloud Run はゼロスケール、Cloud SQL は最小構成、予算アラートを
  Slack に通知

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド / API | Next.js 16 (App Router) / TypeScript |
| 認証 | Firebase Authentication |
| データベース | Cloud SQL for PostgreSQL 18 (Prisma + RLS) |
| インフラ | Terraform (Google Cloud) |
| CI/CD | GitHub Actions (WIF) |

## リポジトリ構成

```
apps/web/     Next.js アプリケーション
terraform/    Terraform (modules + environments/dev)
scripts/      ローカル / CI 共用スクリプト
docs/         詳細ドキュメント
```

## クイックスタート（ローカル開発）

```bash
# Terminal 1: Firebase Auth Emulator
firebase emulators:start --only auth --project demo-mogu

# Terminal 2: アプリ（.env は apps/web/.env.example からコピー）
cd apps/web && pnpm install && pnpm dev
```

http://localhost:3000 を開くと `/login` にリダイレクトされます。

## データモデル

Cloud SQL に置くファクト（スポット / コレクション / 友達 / フラグ）。エージェント会話は Vertex AI Sessions（DB 外）。

```mermaid
erDiagram
    users ||--o{ collections : "所有"
    users ||--o{ spots : "追加"
    collections ||--o{ spots : "含む"
    users ||--o{ friendships : "友達"
    spots ||--o{ recollection_edges : "複製"
    recollection_edges ||--|| flags : "トリガー"
    users ||--o| daily_recommendations : "一推し"

    users {
        text id PK "firebase_uid"
    }
    spots {
        text place_id "Google参照のみ保存"
        int depth "0原本/1一次/2+匿名"
    }
```

完全な ERD・DDL・RLS は [docs/erd-api.md](docs/erd-api.md) を参照。

## ドキュメント

- [確定仕様 v1](docs/spec.md) — 用語・画面・型・ガードレール
- [ERD / API 定義 v1](docs/erd-api.md) — DDL・RLS・API 概要
- [OpenAPI v1](docs/openapi.yaml) — REST 契約（機械可読な正）
- [機能一覧 v1](docs/features.md) — MVP / 磨き / 将来枠
- [セットアップ & 運用ガイド](docs/SETUP.md) — インフラ構築、デプロイ、
  DB マイグレーション、Firebase 設定、監視の詳細手順
- `AGENTS.md` — AI Agent 向けルール（リポジトリ全体 / `terraform/` / `apps/web/`）
