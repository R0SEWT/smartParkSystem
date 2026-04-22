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
        "pad": "0.5",
        "nodesep": "0.8",
        "ranksep": "1.2",
        "fontname": "Helvetica",
        "splines": "spline",
    }

    node_attr = {
        "fontsize": "12",
        "fontname": "Helvetica",
    }

    edge_attr = {
        "fontsize": "10",
        "fontname": "Helvetica",
        "color": "#5A5A5A",
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
        with Cluster("Azure - Brazil South", graph_attr={"bgcolor": "#F4F8FA"}):
            with Cluster("Web & Compute Tier", graph_attr={"bgcolor": "#FFFFFF"}):
                frontend = AppServices("Frontend SPA\n(React, estáticos)")
                api = AppServices("Backend API\n(Flask, Gunicorn)")

            with Cluster("Data Tier", graph_attr={"bgcolor": "#FFFFFF"}):
                pg = DatabaseForPostgresqlServers(
                    "PostgreSQL Flex Server\n(+ PostGIS)"
                )

            with Cluster("Security & Observability", graph_attr={"bgcolor": "#FFFFFF"}):
                kv = KeyVaults("Key Vault\n(Secretos DB/API)")
                mon = ApplicationInsights("App Insights\n+ Log Analytics")

            with Cluster("Async / Burst Ingestion (Opcional)", graph_attr={"style": "dashed", "bgcolor": "#FCFAFA"}):
                fn_timer = FunctionApps("Timer Trigger\n(Ping/Sim)")
                fn_http = FunctionApps("HTTP Trigger\n(/sensor_event)")
                sb = ServiceBus("Service Bus\n(Colas/Topics)")

        with Cluster("MongoDB Atlas", graph_attr={"bgcolor": "#FCFDFC"}):
            mdb = MongoDB("MongoDB Cluster\n(M0 Tier)")

        with Cluster("Usuarios / Fuentes\n(Externo)", graph_attr={"bgcolor": "#ffffff", "color": "#ffffff"}):
            users = User("Usuarios Web / App")
            simulator = Client("Simulador IoT\n(Eventos)")

        # Flujos de entrada principales
        users >> Edge(label="HTTPS") >> frontend
        frontend >> Edge(label="REST/JSON") >> api
        simulator >> Edge(label="POST /sensor_event", color="#1B5E20") >> api

        # Interacciones API -> BD
        api >> Edge(label="SQL\n(Catálogo)", color="#0D47A1") >> pg
        api >> Edge(label="NoSQL\n(Histórico)", color="#0D47A1", style="dashed") >> mdb

        # Interacciones Management
        api >> Edge(style="dotted", label="Lee secretos") >> kv
        api >> Edge(style="dotted", label="Trazas / Logs") >> mon
        pg >> Edge(style="dotted", label="Métricas") >> mon

        # Flujos asíncronos / alternativos
        simulator >> Edge(style="dashed", color="#E65100", label="Alt") >> fn_http
        fn_timer >> Edge(style="dashed", color="#E65100", label="Ping in") >> fn_http
        fn_http >> Edge(style="dashed", color="#E65100", label="Encola") >> sb
        sb >> Edge(style="dashed", color="#E65100", label="API env") >> api


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    output_base = repo_root / "doc" / "assets" / "arch_demo_deploy_az_diagrams"
    build(output_base)


if __name__ == "__main__":
    main()
