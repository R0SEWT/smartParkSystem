from __future__ import annotations

from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.azure.compute import AppServices, FunctionApps
from diagrams.azure.database import DatabaseForPostgresqlServers
from diagrams.azure.integration import ServiceBus
from diagrams.azure.monitor import ApplicationInsights
from diagrams.azure.security import KeyVaults
from diagrams.onprem.client import Client, User
from diagrams.onprem.database import MongoDB


def build(output_base: Path) -> None:
    output_base.parent.mkdir(parents=True, exist_ok=True)

    # Atributos de formato profesional
    graph_attr = {
        "fontsize": "16",
        "pad": "0.7",
        "nodesep": "0.9",
        "ranksep": "1.5",
        "fontname": "Helvetica-Bold",
        "splines": "ortho",
        "nodesep": "1",
        "rankdir": "LR",
    }

    node_attr = {
        "fontsize": "13",
        "fontname": "Helvetica",
    }

    edge_attr = {
        "fontsize": "11",
        "fontname": "Helvetica-Bold",
        "color": "#333333",
        "penwidth": "1.5",
    }

    with Diagram(
        "SmartParkSystem - Arquitectura y Despliegue",
        filename=str(output_base),
        show=False,
        direction="LR",
        outformat="png",
        graph_attr=graph_attr,
        node_attr=node_attr,
        edge_attr=edge_attr,
    ):
        with Cluster("Usuarios y Simuladores", graph_attr={"bgcolor": "transparent", "penwidth": "0"}):
            users = User("Usuarios\nWeb / Mobile")
            simulator = Client("Simulador IoT\n(Python)")

        with Cluster("🚀 Azure - Brazil South", graph_attr={"bgcolor": "#F4F9FD", "style": "rounded", "pencolor": "#0078D4", "penwidth": "2"}):
            
            with Cluster("1. Web & Compute", graph_attr={"bgcolor": "#FFFFFF", "style": "rounded", "pencolor": "#7FBA00"}):
                frontend = AppServices("Frontend SPA\n(React/Vite)")
                api = AppServices("Backend API\n(Flask)")
                
                # Alinear frontend y api
                frontend - Edge(style="invis") - api

            with Cluster("2. Data Services", graph_attr={"bgcolor": "#FFFFFF", "style": "rounded", "pencolor": "#FFB900"}):
                pg = DatabaseForPostgresqlServers("PostgreSQL Flex\n(PostGIS + Catálogo)")

            with Cluster("3. Security & Observability", graph_attr={"bgcolor": "#FFFFFF", "style": "rounded", "pencolor": "#5C2D91"}):
                kv = KeyVaults("Key Vault\n(Secretos)")
                mon = ApplicationInsights("Application Insights")

            with Cluster("4. Optional: Async Burst", graph_attr={"bgcolor": "#FCFDFC", "style": "dashed,rounded"}):
                fn_http = FunctionApps("HTTP Trigger\n(Fast Ingest)")
                fn_timer = FunctionApps("Timer Trigger\n(Ping/Alive)")
                sb = ServiceBus("Service Bus\n(Colas)")

        with Cluster("🍃 MongoDB Atlas", graph_attr={"bgcolor": "#F4FAF6", "style": "rounded", "pencolor": "#13AA52", "penwidth": "2"}):
            mdb = MongoDB("Atlas Cluster\n(M0 Tier / Eventos)")

        # Flujos de entrada principales (Usuarios)
        users >> Edge(label=" HTTPS ", color="#0078D4", fontcolor="#0078D4") >> frontend
        frontend >> Edge(label=" API REST ", color="#0078D4", fontcolor="#0078D4") >> api
        
        # Flujo de Simulador
        simulator >> Edge(label=" POST /sensor_event ", color="#107C10", fontcolor="#107C10") >> api

        # Interacciones API -> Bases de datos
        api >> Edge(label=" SQL (Config) ", color="#FF8C00", fontcolor="#D83B01") >> pg
        api >> Edge(label=" BSON (Histórico) ", color="#13AA52", fontcolor="#13AA52") >> mdb

        # Governance & Observability (Dotted)
        api >> Edge(style="dotted", label=" Env Vars", color="#5C2D91", fontcolor="#5C2D91") >> kv
        api >> Edge(style="dotted", label=" Telemetry ", color="#5C2D91", fontcolor="#5C2D91") >> mon
        pg >> Edge(style="dotted", label=" Metrics ", color="#5C2D91", fontcolor="#5C2D91") >> mon

        # Opcional (Asíncrono)
        simulator >> Edge(style="dashed", color="#D83B01", fontcolor="#D83B01", label=" HTTP ") >> fn_http
        fn_timer >> Edge(style="dashed", color="#D83B01", fontcolor="#D83B01", label=" Ping ") >> fn_http
        fn_http >> Edge(style="dashed", color="#D83B01", fontcolor="#D83B01", label=" Messages ") >> sb
        sb >> Edge(style="dashed", color="#D83B01", fontcolor="#D83B01", label=" Pull ") >> api


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    output_base = repo_root / "doc" / "assets" / "arch_demo_deploy_az_diagrams"
    build(output_base)


if __name__ == "__main__":
    main()
