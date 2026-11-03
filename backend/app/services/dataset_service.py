import json
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import settings
from app.modules.understanding.loader import (
    load_dataset,
)
from app.modules.understanding.profiler import profile_dataset
from app.schemas.dataset import DatasetProfile

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xlsm"}


class DatasetServiceError(Exception):
    pass


async def save_upload(upload: UploadFile) -> tuple[Path, str]:
    filename = Path(upload.filename or "").name

    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise DatasetServiceError(
            "Only CSV, XLSX, and XLSM files are supported."
        )

    dataset_id = str(uuid.uuid4())

    dataset_directory = settings.storage_dir / dataset_id

    dataset_directory.mkdir(
        parents=True,
        exist_ok=False,
    )

    destination = dataset_directory / f"original{extension}"

    total_size = 0
    max_size = settings.max_upload_size_mb * 1024 * 1024

    try:
        with destination.open("wb") as output:
            while True:
                chunk = await upload.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > max_size:
                    raise DatasetServiceError(
                        f"File exceeds the {settings.max_upload_size_mb} MB limit."
                    )

                output.write(chunk)

        if total_size == 0:
            raise DatasetServiceError("Uploaded file is empty.")

        return destination, dataset_id

    except Exception:
        destination.unlink(missing_ok=True)

        try:
            dataset_directory.rmdir()
        except OSError:
            pass

        raise

    finally:
        await upload.close()


def analyse_saved_dataset(
    file_path: Path,
    dataset_id: str,
    original_filename: str,
) -> DatasetProfile:

    try:
        dataframe = load_dataset(file_path)

        profile = profile_dataset(
            dataframe=dataframe,
            dataset_id=dataset_id,
            filename=original_filename,
            file_type=file_path.suffix.lower().replace(".", ""),
        )

        metadata_path = file_path.parent / "profile.json"

        metadata_path.write_text(
            json.dumps(
                profile.model_dump(mode="json"),
                indent=2,
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        return profile

    except Exception:
        import shutil

        shutil.rmtree(file_path.parent, ignore_errors=True)
        raise


def get_dataset_profile(dataset_id: str) -> DatasetProfile:
    if not dataset_id or any(
        character not in "0123456789abcdef-"
        for character in dataset_id.lower()
    ):
        raise DatasetServiceError("Invalid dataset ID.")

    metadata_path = (
        settings.storage_dir
        / dataset_id
        / "profile.json"
    )

    if not metadata_path.is_file():
        raise FileNotFoundError("Dataset was not found.")

    try:
        data = json.loads(
            metadata_path.read_text(encoding="utf-8")
        )

        return DatasetProfile.model_validate(data)

    except (ValueError, OSError) as exc:
        raise DatasetServiceError(
            "Unable to read dataset metadata."
        ) from exc