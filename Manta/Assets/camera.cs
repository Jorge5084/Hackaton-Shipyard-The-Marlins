using UnityEngine;

public class camera : MonoBehaviour
{
    public Transform player;
    public Vector3 offset = new Vector3(0, 5, -100);

    void LateUpdate()
    {
        transform.position = player.position + offset;
    }
}