"""Seed compliance_mappings table with 20 NIST 800-53 entries."""

import asyncio

from sqlalchemy import select

from app.database import async_session, engine, Base
from app.models import ComplianceMapping  # noqa: F401 — importing from __init__ registers all models on Base

SEED_DATA = [
    # Spoofing
    ("Spoofing", "trust_boundary_identity_spoofing", "IA-2", "Identification and Authentication (Organizational Users)"),
    ("Spoofing", "trust_boundary_identity_spoofing", "IA-8", "Identification and Authentication (Non-Organizational Users)"),
    ("Spoofing", "service_spoofing", "IA-3", "Device Identification and Authentication"),
    ("Spoofing", "service_spoofing", "SC-8", "Transmission Confidentiality and Integrity"),
    ("Spoofing", "unauthenticated_entity", "IA-2", "Identification and Authentication (Organizational Users)"),
    ("Spoofing", "unauthenticated_entity", "IA-5", "Authenticator Management"),
    # Tampering
    ("Tampering", "unencrypted_cross_boundary_flow", "SC-8", "Transmission Confidentiality and Integrity"),
    ("Tampering", "unencrypted_cross_boundary_flow", "SC-13", "Cryptographic Protection"),
    ("Tampering", "cross_boundary_data_store_access", "AC-3", "Access Enforcement"),
    ("Tampering", "cross_boundary_data_store_access", "AC-4", "Information Flow Enforcement"),
    ("Tampering", "external_input_tampering", "SI-10", "Information Input Validation"),
    ("Tampering", "external_input_tampering", "SI-15", "Information Output Filtering"),
    ("Tampering", "no_integrity_validation", "SI-7", "Software, Firmware, and Information Integrity"),
    ("Tampering", "no_integrity_validation", "SC-8", "Transmission Confidentiality and Integrity"),
    # Repudiation
    ("Repudiation", "unlogged_writes", "AU-2", "Event Logging"),
    ("Repudiation", "unlogged_writes", "AU-3", "Content of Audit Records"),
    ("Repudiation", "unaudited_data_modification", "AU-2", "Event Logging"),
    ("Repudiation", "unaudited_data_modification", "AU-12", "Audit Record Generation"),
    ("Repudiation", "unauthenticated_boundary_crossing", "AU-3", "Content of Audit Records"),
    ("Repudiation", "unauthenticated_boundary_crossing", "IA-2", "Identification and Authentication (Organizational Users)"),
    # Information Disclosure
    ("Information Disclosure", "sensitive_data_cross_boundary_flow", "SC-8", "Transmission Confidentiality and Integrity"),
    ("Information Disclosure", "sensitive_data_cross_boundary_flow", "SC-28", "Protection of Information at Rest"),
    ("Information Disclosure", "credential_store_exposure", "SC-28", "Protection of Information at Rest"),
    ("Information Disclosure", "credential_store_exposure", "IA-5", "Authenticator Management"),
    ("Information Disclosure", "unencrypted_data_flow", "SC-8", "Transmission Confidentiality and Integrity"),
    ("Information Disclosure", "unencrypted_data_flow", "SC-13", "Cryptographic Protection"),
    ("Information Disclosure", "cross_boundary_data_exposure", "AC-4", "Information Flow Enforcement"),
    ("Information Disclosure", "cross_boundary_data_exposure", "SC-7", "Boundary Protection"),
    # Denial of Service
    ("Denial of Service", "unbounded_external_input", "SC-5", "Denial-of-Service Protection"),
    ("Denial of Service", "unbounded_external_input", "SI-10", "Information Input Validation"),
    ("Denial of Service", "resource_exhaustion_target", "SC-5", "Denial-of-Service Protection"),
    ("Denial of Service", "resource_exhaustion_target", "CP-9", "System Backup"),
    ("Denial of Service", "single_point_of_failure", "CP-9", "System Backup"),
    ("Denial of Service", "single_point_of_failure", "CP-10", "System Recovery and Reconstitution"),
    # Elevation of Privilege
    ("Elevation of Privilege", "cross_boundary_privilege_escalation", "AC-6", "Least Privilege"),
    ("Elevation of Privilege", "cross_boundary_privilege_escalation", "AC-3", "Access Enforcement"),
    ("Elevation of Privilege", "direct_data_store_access_bypass", "AC-3", "Access Enforcement"),
    ("Elevation of Privilege", "direct_data_store_access_bypass", "AC-4", "Information Flow Enforcement"),
    ("Elevation of Privilege", "broad_trust_boundary_surface", "AC-4", "Information Flow Enforcement"),
    ("Elevation of Privilege", "broad_trust_boundary_surface", "SC-7", "Boundary Protection"),
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        existing = await session.execute(select(ComplianceMapping.id))
        if existing.scalars().first() is not None:
            print("Compliance mappings already seeded, skipping.")
            return

        for stride_cat, subtype, control_id, control_name in SEED_DATA:
            session.add(
                ComplianceMapping(
                    stride_category=stride_cat,
                    threat_subtype=subtype,
                    nist_control_id=control_id,
                    nist_control_name=control_name,
                )
            )
        await session.commit()
        print(f"Seeded {len(SEED_DATA)} compliance mappings.")


if __name__ == "__main__":
    asyncio.run(seed())
